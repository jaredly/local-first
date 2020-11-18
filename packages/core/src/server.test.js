// @-flow

import type { ClientMessage, ServerMessage } from './server';

import * as ncrdt from '../../nested-object-crdt/src/new';
import * as rich from '../../rich-text-crdt/index';
import makePersistence from '../../idb/src/delta-mem';
import * as client from './delta/create-client';
import * as server from './server';
import setupSqliteServerPersistence from '../../server-bundle/sqlite-persistence';
import { validateDelta } from '../../nested-object-crdt/src/schema.js';
import setupServerPersistence from './memory-persistence';
import { PersistentClock, inMemoryClockPersist } from './persistent-clock';
import { type CRDTImpl, getCollection } from './shared';
import type { ServerState, CRDTImpl as ServerCRDTImpl } from './server';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

const serverCrdt: ServerCRDTImpl<Delta, Data> = {
    createEmpty: ncrdt.createEmpty,
    deltas: {
        stamp: data => ncrdt.deltas.stamp(data, () => null),
    },
    applyDelta: (base, delta) =>
        ncrdt.applyDelta(
            base,
            delta,
            // $FlowFixMe
            applyOtherDelta,
            otherMerge,
        ),
};

const newCrdt: CRDTImpl<Delta, Data> = {
    merge: (one, two) => {
        if (!one) return two;
        // $FlowFixMe
        return ncrdt.mergeTwo(one, two, () => {
            throw new Error('nope');
        });
    },
    value: d => d.value,
    latestStamp: data => ncrdt.latestStamp(data, () => null),
    applyDelta: (base, delta) =>
        ncrdt.applyDelta(
            base,
            delta,
            // $FlowFixMe
            applyOtherDelta,
            otherMerge,
        ),
    deltas: {
        ...ncrdt.deltas,
        stamp: data => ncrdt.deltas.stamp(data, () => null),
        apply: (base, delta) =>
            ncrdt.applyDelta(
                base,
                delta,
                // $FlowFixMe
                applyOtherDelta,
                otherMerge,
            ),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return ncrdt.createWithSchema(value, stamp, getStamp, schema, value => null);
    },
};

/*

server-boot-up
client -> hello
server -> datas
client -> ack
...
client -> new changes
server -> ack, new cursor?
client -> ack
...
client2 -> new changes
server -> ack, new cursor
server -> client2 datas + cursor
client -> ack
client2 -> ack

*/

type Data = ncrdt.CRDT<any, any>;
type Delta = ncrdt.Delta<any, any, rich.Delta>;

const schemas = {
    items: {
        type: 'object',
        attributes: {
            one: 'int',
            three: 'string',
            five: { type: 'object', attributes: { six: 'int' } },
        },
    },
    people: { type: 'object', attributes: { name: 'string', age: 'int' } },
};

const getSchemaChecker = colid =>
    schemas[colid] ? delta => validateDelta(schemas[colid], delta) : null;

const collections = ['items'];
const initialValue = ncrdt.createDeep({ one: 2, three: '4', five: { six: 7 } }, '1');
const someMessages = [
    {
        node: 'yes',
        delta: ncrdt.deltas.replace(initialValue),
    },
    {
        node: 'yes',
        delta: ncrdt.deltas.set(initialValue, ['five', 'six'], ncrdt.createDeep(8, '2')),
    },
];
const expectedValue = { yes: { one: 2, three: '4', five: { six: 8 } } };

const createClient = (sessionId, collections, messages) => {
    const persistence = makePersistence(collections);
    const state = client.initialState(persistence.collections);
    const clock = new PersistentClock(inMemoryClockPersist());
    // client
    return {
        sessionId,
        collections,
        persistence,
        getMessages(): Promise<Array<ClientMessage<Delta, Data>>> {
            return client.getMessages(persistence, false);
        },
        receive(
            messages: Array<ServerMessage<Delta, Data>>,
        ): Promise<Array<ClientMessage<Delta, Data>>> {
            return client.handleMessages(
                newCrdt,
                persistence,
                messages,
                state,
                clock.recv,
                () => {},
            );
        },
        async getState() {
            const data = {};
            for (let col of collections) {
                data[col] = await this.getCollection(col).loadAll();
            }
            return data;
        },
        getCollection(colid: string) {
            return getCollection(
                colid,
                newCrdt,
                persistence,
                state[colid],
                clock.get,
                () => {},
                () => {},
                schemas[colid],
            );
        },
    };
};

const createServer = deltas => {
    const state: ServerState<Delta, Data> = server.default(
        serverCrdt,
        setupServerPersistence(),
        // setupSqliteServerPersistence('.test-data'),
        getSchemaChecker,
    );
    if (deltas) {
        Object.keys(deltas).forEach(collection => {
            server.onMessage(state, '-none-', {
                type: 'sync',
                collection,
                serverCursor: -1,
                deltas: deltas[collection],
            });
        });
    }

    // server
    return {
        getMessages(sessionId: string): Array<ServerMessage<Delta, Data>> {
            return server.getMessages(state, sessionId);
        },
        receive(
            sessionId: string,
            messages: Array<ClientMessage<Delta, Data>>,
        ): Array<ServerMessage<Delta, Data>> {
            const responses = messages
                .map(message => server.onMessage(state, sessionId, message))
                .filter(Boolean);
            return responses;
        },
        getState(collections: Array<string>) {
            const data = {};
            collections.forEach(cid => {
                data[cid] = {};
                const fulls = {};
                const result = state.persistence.deltasSince(cid, -1, '');
                if (!result) return;
                result.deltas.forEach(({ node, delta }) => {
                    fulls[node] = state.crdt.applyDelta(fulls[node], delta);
                });
                Object.keys(fulls).forEach(key => {
                    data[cid][key] = fulls[key].value;
                });
            });
            return data;
        },
    };
};

// const fs = require('fs');
// beforeAll(() => {
//     fs.mkdirSync('./.test-data');
// });
// afterAll(() => {
//     fs.unlinkSync('./.test-data/data.db');
//     fs.rmdirSync('./.test-data');
// });

describe('client-server interaction', () => {
    it('Clean both - initial handshake', async () => {
        const client = createClient('a', ['items']);
        const server = createServer();
        const initialClient = await client.getMessages();
        expect(initialClient).toEqual(
            client.collections.map(name => ({
                type: 'sync',
                collection: name,
                serverCursor: undefined,
                deltas: [],
            })),
        );
        expect(server.receive(client.sessionId, initialClient)).toEqual([]);
        const initialServer = server.getMessages(client.sessionId);
        expect(initialServer).toEqual(
            client.collections.map(collection => ({
                type: 'sync',
                collection,
                serverCursor: -1,
                deltas: [],
            })),
        );
        const acks = await client.receive(initialServer);
        expect(acks).toEqual(
            client.collections.map(collection => ({
                type: 'ack',
                collection,
                serverCursor: -1,
            })),
        );
        expect(await client.getMessages()).toEqual([]);
        expect(server.receive(client.sessionId, acks)).toEqual([]);
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(await client.getState()).toEqual(server.getState(client.collections));
    });

    it('Clean client, server with data should back and forth', async () => {
        const client = createClient('a', ['items']);
        const server = createServer({ items: someMessages });
        // hello world, back and forth
        const acks = server.receive(client.sessionId, await client.getMessages());
        const allServer = acks.concat(server.getMessages(client.sessionId));
        console.log(allServer);
        const clientAcks = await client.receive(allServer);
        // expect(clientAcks).toEqual([]);
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(await client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(await client.getState()).toEqual(server.getState(client.collections));
        expect(await client.getState()).toEqual({ items: expectedValue });
    });

    it('Clean client, clean server, then client does a thing', async () => {
        const client = createClient('a', ['people']);
        const server = createServer();
        const acks = server.receive(client.sessionId, await client.getMessages()); // hello world
        const clientAcks = await client.receive(acks.concat(server.getMessages(client.sessionId)));
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(await client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(await client.getState()).toEqual(server.getState(client.collections));
        //
        const col = client.getCollection('people');
        await col.save('two', { name: 'yoo', age: 4 });
        await col.setAttribute('two', ['age'], 100);
        const clientMessages = await client.getMessages();
        expect(clientMessages.length).toEqual(1);
        const serverAcks = server.receive(client.sessionId, clientMessages);
        expect(serverAcks[0].type).toEqual('ack');
        expect(
            await client.receive(serverAcks.concat(server.getMessages(client.sessionId))),
        ).toEqual([]);
    });

    const settle = async (server, client) => {
        let clientMessages = await client.getMessages();
        let serverAcks = clientMessages.length
            ? server.receive(client.sessionId, clientMessages)
            : [];
        let serverMessages = serverAcks.concat(server.getMessages(client.sessionId));
        if (!serverMessages.length) {
            return { clientMessages, serverMessages, clientResponses: [], serverResponses: [] };
        }
        let clientResponses = await client.receive(serverMessages);
        let serverResponses = server.receive(client.sessionId, clientResponses);
        if (serverResponses.length) {
            throw new Error('after back & forth, server still wanted to ack');
        }
        return { clientMessages, serverMessages, clientResponses, serverResponses };
    };

    const settleMulti = async (server, clients) => {
        const allMessages = [];
        for (let rounds = 0; rounds < 10; rounds++) {
            let settled = true;
            const roundMessages = {};
            for (let client of clients) {
                const messages = await settle(server, client);
                roundMessages[client.sessionId] = messages;
                if (messages.serverMessages.length) {
                    settled = false;
                }
            }
            allMessages.push(roundMessages);
            if (settled) {
                return allMessages;
            }
        }
    };

    it('Two clients, should sync', async () => {
        const client = createClient('a', ['people']);
        const clientB = createClient('b', ['people']);
        const server = createServer();

        expect(await settleMulti(server, [client, clientB])).toHaveLength(2);

        // Client and server now have equal state
        expect(await client.getState()).toEqual(server.getState(client.collections));
        expect(await clientB.getState()).toEqual(server.getState(clientB.collections));

        const col = client.getCollection('people');
        await col.save('two', { name: 'yoo', age: 4 });
        await col.setAttribute('two', ['age'], 100);

        expect(await settleMulti(server, [client, clientB])).toHaveLength(2);

        // Client and server now have equal state
        expect(await client.getState()).toEqual(server.getState(client.collections));
        expect(await clientB.getState()).toEqual(server.getState(clientB.collections));

        expect(await clientB.getCollection('people').load('two')).toEqual({
            name: 'yoo',
            age: 100,
        });
    });

    const settleAndAssert = async (server, clients) => {
        const allMessages = await settleMulti(server, clients);
        for (let client of clients) {
            expect(await client.getState()).toEqual(server.getState(client.collections));
        }
        expect(allMessages).toMatchSnapshot();
    };

    // OOOH IDEA: What if I did snapshot testing of the chatter? like the messages passed back and forth?
    // I like it a lot. would have to nail down the RNG and Date to make it deterministic.
    it('Two clients, incremental sync', async () => {
        const client = createClient('a', ['people']);
        const clientB = createClient('b', ['people']);
        const server = createServer();

        await settleAndAssert(server, [client, clientB]);

        const col = client.getCollection('people');
        await col.save('two', { name: 'yoo', age: 4 });

        await settleAndAssert(server, [client, clientB]);

        await col.setAttribute('two', ['age'], 100);

        await settleAndAssert(server, [client, clientB]);

        expect(await clientB.getCollection('people').load('two')).toEqual({
            name: 'yoo',
            age: 100,
        });
    });

    it('Client that gets an unexpected update should request a full dump', async () => {
        fail;
    });

    it('If client accidentally loses all data, it should request a full dump on startup', async () => {
        fail;
    });
});
