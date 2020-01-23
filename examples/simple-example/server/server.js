// @flow
import * as hlc from '@local-first/hybrid-logical-clock';

export type ClientMessage<Delta, Data> = {
    type: 'sync',
    collection: string,
    lastSeenDelta: number,
    deltas: Array<{ node: string, delta: Delta }>,
};

export type ServerMessage<Delta, Data> =
    | {
          type: 'sync',
          collection: string,
          lastSeenDelta: number,
          deltas: Array<{ node: string, delta: Delta }>,
      }
    | {
          type: 'full',
          collection: string,
          data: { [key: string]: Data },
          lastSeenDelta: number,
      };

// This doesn't have any special permissions things
// We'll do collection-level permissions.

type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
};

type Collection<Delta, Data> = {
    data: { [key: string]: Data },
    deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
};

type Connection<Delta, Data> = {
    sessionId: string,
    send: (msg: ServerMessage<Delta, Data>) => void,
    on: (listener: (msg: ClientMessage<Delta, Data>) => void) => void,
};

/*

Typical rest interaction

!!! Last seen for a fresh unsynced collection is -1

First run:

Client boots up.
client -> server "hello world" ... with the collections it wants though.
server -> client "full stuffs"

ok so when creating the client, you can say "here are the collections to ask for up front" I guess.

Second run:
Client boots up, inflates data from storage.
client -> server "hello world" here's the collections and their last seen thing

 */

type ServerState<Delta, Data> = {
    crdt: CRDTImpl<Delta, Data>,
    collections: {
        [collectionId: string]: Collection<Delta, Data>,
    },
};

const applyDeltas = function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    nodes: { [key: string]: Data },
    deltas: Array<{ node: string, delta: Delta }>,
) {
    deltas.forEach(delta => {
        if (!nodes[delta.node]) {
            nodes[delta.node] = crdt.createEmpty();
        }
        nodes[delta.node] = crdt.applyDelta(nodes[delta.node], delta.delta);
    });
};

export const onMessage = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
    message: ClientMessage<Delta, Data>,
): ?ServerMessage<Delta, Data> {
    if (message.type === 'sync') {
        // collection: user/{id}/priv/colname
        // collection: user/{id}/pub/colname
        // TODO validate access to message.collection
        if (!state.collections[message.collection]) {
            state.collections[message.collection] = { data: {}, deltas: [] };
        }
        message.deltas.forEach(item => {
            state.collections[message.collection].deltas.push({
                ...item,
                sessionId: sessionId,
            });
        });
        applyDeltas(
            state.crdt,
            state.collections[message.collection].data,
            message.deltas,
        );
        if (message.lastSeenDelta === -1) {
            return {
                type: 'full',
                collection: message.collection,
                data: state.collections[message.collection].data,
                lastSeenDelta:
                    state.collections[message.collection].deltas.length,
            };
        } else {
            return {
                type: 'sync',
                collection: message.collection,
                deltas: state.collections[message.collection].deltas
                    .slice(message.lastSeenDelta)
                    .filter(delta => delta.sessionId !== sessionId)
                    .map(({ node, delta }) => ({ node, delta })),
                lastSeenDelta:
                    state.collections[message.collection].deltas.length,
            };
        }
    }
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
): ServerState<Delta, Data> => {
    const collections: {
        [collectionId: string]: Collection<Delta, Data>,
    } = {};

    return { collections, crdt };
};

export default make;
