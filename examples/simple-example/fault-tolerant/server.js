// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/lib/schema.js';

// OK folks, we're using sqlite for persistence. This is *synchronous*, which is lots of fun.
// And so we can I guess design an API that expects that.

/*

client -> server "here are some deltas"
server stores deltas
server stores data changes

ok so well the simplest way would be to not even store the changes, right?

And then, as an optimization, I could add in "we track the data too folks"

OK so simple mode:
client -> server "collection, no 'last delta seen'"
server gets all the deltas for that collection, and sends them
client -> server "some changes"
server puts those changes in the db
and then fetches them again ha ha

yeah what would the "simplest" backend look like, that just completely
relies on sqlite for all the things?


*/

export type ClientMessage<Delta, Data> = {
    type: 'sync',
    collection: string,
    serverCursor: ?string,
    deltas: Array<{ node: string, delta: Delta }>,
};

export type ServerMessage<Delta, Data> =
    | {
          type: 'sync',
          collection: string,
          serverCursor: ?string,
          deltas: Array<{ node: string, delta: Delta }>,
      }
    // Indicating that deltas from a client have been received.
    | { type: 'ack', deltaStamp: string };
// | {
//       type: 'full',
//       collection: string,
//       data: { [key: string]: Data },
//       lastSeenDelta: number,
//   };

// This doesn't have any special permissions things
// We'll do collection-level permissions.

type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
};

export type Persistence<Delta, Data> = {
    deltasSince(
        collection: string,
        lastSeen: ?string,
    ): {
        deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
        cursor: string,
    },
    addDeltas(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
    ): void,
    // TODO maybe store nodes too though
    // This would be quite interesting really.
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
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    getSchema: string => Schema,
    clients: {
        [sessionId: string]: {
            collections: {
                [collectionId: string]: string,
            },
        },
    },
};

// const applyDeltas = function<Delta, Data>(
//     schema: Schema,
//     crdt: CRDTImpl<Delta, Data>,
//     nodes: { [key: string]: Data },
//     deltas: Array<{ node: string, delta: Delta }>,
// ) {
//     const changed = {};
//     deltas.forEach(delta => {
//         if (!nodes[delta.node]) {
//             nodes[delta.node] = crdt.createEmpty();
//         }
//         changed[delta.node] = true;
//         nodes[delta.node] = crdt.applyDelta(nodes[delta.node], delta.delta);
//     });
//     return Object.keys(changed);
// };

export const getMessages = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
): Array<ServerMessage<Delta, Data>> {
    if (!state.clients[sessionId]) {
        return [];
    }
    return Object.keys(state.clients[sessionId].collections)
        .map((cid: string): ?ServerMessage<Delta, Data> => {
            const lastSeen = state.clients[sessionId].collections[cid];
            const { cursor, deltas } = state.persistence.deltasSince(
                cid,
                lastSeen,
            );
            if (deltas.length) {
                return {
                    type: 'sync',
                    collection: cid,
                    deltas: deltas.map(({ node, delta }) => ({
                        node,
                        delta,
                    })),
                    serverCursor: cursor,
                };
            }
        })
        .filter(Boolean);
};

// export const hasCollection = function<Delta, Data>(
//     state: ServerState<Delta, Data>,
//     col: string,
// ) {
//     return !!state.collections[col];
// };

// export const loadCollection = async function<Delta, Data>(
//     state: ServerState<Delta, Data>,
//     collection: string,
// ): Promise<void> {
//     if (state.collections[collection]) {
//         return;
//     }
//     state.collections[collection] = await state.persistence.load(collection);
// };

export const onMessage = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
    message: ClientMessage<Delta, Data>,
): ?ServerMessage<Delta, Data> {
    if (message.type === 'sync') {
        if (!state.clients[sessionId]) {
            state.clients[sessionId] = { collections: {} };
        }
        const schema = state.getSchema(message.collection);
        state.clients[sessionId].collections[message.collection] =
            message.serverCursor;
        // collection: user/{id}/priv/colname
        // collection: user/{id}/pub/colname
        // TODO validate access to message.collection
        // const startingIndex =
        //     state.collections[message.collection].deltas.length;
        const deltas = message.deltas.map(item => ({ ...item, sessionId }));
        state.persistence.addDeltas(message.collection, deltas);
        // state.collections[message.collection].deltas.push(...deltas);

        // message.deltas.forEach(item => {
        //     state.collections[message.collection].deltas.push({
        //         ...item,
        //         sessionId: sessionId,
        //     });
        // });

        // const changed = applyDeltas(
        //     schema,
        //     state.crdt,
        //     state.collections[message.collection].data,
        //     message.deltas,
        // );
        // state.persistence.update(
        //     message.collection,
        //     startingIndex,
        //     deltas,
        //     changed.map(key => ({
        //         key,
        //         data: state.collections[message.collection].data[key],
        //     })),
        // );
    }
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence<Delta, Data>,
    getSchema: string => Schema,
): ServerState<Delta, Data> => {
    return { crdt, persistence, getSchema, clients: {} };
};

export default make;
