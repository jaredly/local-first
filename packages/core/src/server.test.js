// @flow

import type { ClientMessage, ServerMessage } from './server';

import * as ncrdt from '../../nested-object-crdt/src/new';
import * as rich from '../../rich-text-crdt/index';
import makePersistence from '../../idb/src/delta-mem';
import * as client from './delta/create-client';
import * as server from './server';
import setupServerPersistence from './memory-persistence';
import { PersistentClock, inMemoryClockPersist } from './persistent-clock';
import type { CRDTImpl } from './shared';
import type { ServerState } from './server';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

const newCrdt: CRDTImpl<Delta, Data> = {
    merge: (one, two) => {
        if (!one) return two;
        // $FlowFixMe
        return ncrdt.mergeTwo(one, two, () => {
            throw new Error('nope');
        });
    },
    latestStamp: data => ncrdt.latestStamp(data, () => null),
    value: d => d.value,
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
        return ncrdt.createWithSchema(
            value,
            stamp,
            getStamp,
            schema,
            value => null,
        );
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

const collections = ['items'];
const someMessages = [];

const createClient = (sessionId, messages) => {
    const persistence = makePersistence('yolo', collections);
    const state = client.initialState(persistence.collections);
    const clock = new PersistentClock(inMemoryClockPersist());
    // client
    return {
        sessionId,
        collections,
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
        getState() {
            const data = {};
            Object.keys(state).forEach(col => {
                data[col] = state[col].cache;
            });
            return data;
        },
    };
};

const createServer = messages => {
    const state: ServerState<Delta, Data> = server.default<Delta, Data>(
        newCrdt,
        setupServerPersistence<Delta, Data>(),
    );
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
            //
        },
    };
};

describe('client-server interaction', () => {
    it('Clean client, clean server should only require messages one way', async () => {
        const client = createClient('a');
        const server = createServer();
        const acks = server.receive(
            client.sessionId,
            await client.getMessages(),
        );
        // No client ack's
        expect(
            await client.receive(
                acks.concat(server.getMessages(client.sessionId)),
            ),
        ).toEqual([]);
        // client has no new data, there's no server cursor to ack
        expect(await client.getMessages()).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });

    it('Clean client, server with data should back and forth', async () => {
        const client = createClient('a');
        const server = createServer(someMessages);
        const acks = server.receive(
            client.sessionId,
            await client.getMessages(),
        ); // hello world
        const clientAcks = await client.receive(
            acks.concat(server.getMessages(client.sessionId)),
        );
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(await client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });

    it('Clean client, clean server, then client does a thing', async () => {
        const client = createClient('a');
        const server = createServer();
        const acks = server.receive(
            client.sessionId,
            await client.getMessages(),
        ); // hello world
        const clientAcks = await client.receive(
            acks.concat(server.getMessages(client.sessionId)),
        );
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(await client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });
});
