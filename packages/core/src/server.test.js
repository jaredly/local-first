// @flow

import type { ClientMessage, ServerMessage } from './server';

import * as ncrdt from '../../nested-object-crdt/src/new';
import * as rich from '../../rich-text-crdt/index';
// import * as ncrdt from '../../../public/nested-object-crdt';
// import * as rich from '../../../public/rich-text-crdt';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

const newCrdt = {
    merge: (one, two) => {
        if (!one) return two;
        return ncrdt.mergeTwo(one, two, () => {
            throw new Error('nope');
        });
    },
    latestStamp: ncrdt.latestStamp,
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

type Data = {};
type Delta = {};

const collections = ['one'];
const someMessages = [];

const createClient = (sessionId, messages) => {
    // client
    return {
        sessionId,
        collections,
        getMessages(): Array<ClientMessage<Data, Delta>> {
            //
            return [];
        },
        receive(
            messages: Array<ServerMessage<Data, Delta>>,
        ): Array<ClientMessage<Data, Delta>> {
            //
            return [];
        },
        getState() {
            //
        },
    };
};

const createServer = messages => {
    // server
    return {
        getMessages(sessionId: string): Array<ServerMessage<Data, Delta>> {
            //
            return [];
        },
        receive(
            sessionId: string,
            messages: Array<ClientMessage<Data, Delta>>,
        ): Array<ServerMessage<Data, Delta>> {
            //
            return [];
        },
        getState(collections: Array<string>) {
            //
        },
    };
};

describe('client-server interaction', () => {
    it('Clean client, clean server should only require messages one way', () => {
        const client = createClient('a');
        const server = createServer();
        const acks = server.receive(client.sessionId, client.getMessages());
        // No client ack's
        expect(
            client.receive(acks.concat(server.getMessages(client.sessionId))),
        ).toEqual([]);
        // client has no new data, there's no server cursor to ack
        expect(client.getMessages()).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });

    it('Clean client, server with data should back and forth', () => {
        const client = createClient('a');
        const server = createServer(someMessages);
        const acks = server.receive(client.sessionId, client.getMessages()); // hello world
        const clientAcks = client.receive(
            acks.concat(server.getMessages(client.sessionId)),
        );
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });

    it('Clean client, clean server, then client does a thing', () => {
        const client = createClient('a');
        const server = createServer();
        const acks = server.receive(client.sessionId, client.getMessages()); // hello world
        const clientAcks = client.receive(
            acks.concat(server.getMessages(client.sessionId)),
        );
        // client is ack'ing the server's data, but doesn't have its own messages.
        server.receive(client.sessionId, clientAcks);
        expect(client.getMessages()).toEqual([]);
        // Server now has nothing more to send
        expect(server.getMessages(client.sessionId)).toEqual([]);
        expect(client.getState()).toEqual(server.getState(client.collections));
    });
});
