// @flow
import * as hlc from '../../hybrid-logical-clock';

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

export type ClientMessage<Delta, Data> =
    | {|
          type: 'sync',
          collection: string,
          serverCursor: ?CursorType,
          deltas: Array<{ node: string, delta: Delta }>,
      |}
    | {| type: 'ack', collection: string, serverCursor: CursorType |};

export type ServerMessage<Delta, Data> =
    | {|
          type: 'sync',
          collection: string,
          serverCursor: CursorType,
          deltas: Array<{ node: string, delta: Delta }>,
      |}
    // Indicating that deltas from a client have been received.
    | {| type: 'ack', collection: string, deltaStamp: string |};

// This doesn't have any special permissions things
// We'll do collection-level permissions.

export type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
    deltas: {
        stamp: Delta => string,
    },
};

export type CursorType = number;

export type Persistence<Delta, Data> = {
    deltasSince(
        collection: string,
        lastSeen: ?CursorType,
        sessionId: string,
    ): ?{
        deltas: Array<{ node: string, delta: Delta }>,
        cursor: CursorType,
    },
    addDeltas(
        collection: string,
        sessionId: string,
        deltas: Array<{ node: string, delta: Delta }>,
    ): void,
    compact(collection: string, date: number, merge: (Delta, Delta) => Delta): void,
    // TODO maybe store nodes too though
    // This would be quite interesting really.
};

type Connection<Delta, Data> = {
    sessionId: string,
    send: (msg: ServerMessage<Delta, Data>) => void,
    on: (listener: (msg: ClientMessage<Delta, Data>) => void) => void,
};

export type ServerState<Delta, Data> = {
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    getSchemaChecker: string => ?(Delta) => ?string,
    clients: {
        [sessionId: string]: {
            collections: {
                [collectionId: string]: ?CursorType,
            },
        },
    },
};

export const getMessages = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
): Array<ServerMessage<Delta, Data>> {
    if (!state.clients[sessionId]) {
        // console.log(`No clients registered for ${sessionId}`);
        return [];
    }
    const colids = Object.keys(state.clients[sessionId].collections);
    // console.log(`Getting messages for ${sessionId}: ${colids.join(',')}`);
    return colids
        .map((cid: string): ?ServerMessage<Delta, Data> => {
            const lastSeen = state.clients[sessionId].collections[cid];
            const result = state.persistence.deltasSince(cid, lastSeen, sessionId);
            if ((!result || !result.deltas.length) && lastSeen == null) {
                return {
                    type: 'sync',
                    collection: cid,
                    deltas: [],
                    serverCursor: -1,
                };
            }
            if (!result) {
                // console.log(
                //     `no new messages since ${
                //         lastSeen != null ? lastSeen : 'no-start'
                //     } for ${cid} (${sessionId})`,
                // );
                return;
            }
            const { cursor, deltas } = result;
            // console.log('getting all since', lastSeen, cursor, deltas);
            if (deltas.length) {
                if (cursor == null) {
                    throw new Error(`Got deltas, but no cursor`);
                }
                // console.log(
                //     `${deltas.length} new deltas for ${cid} since ${
                //         lastSeen != null ? lastSeen : 'no-start'
                //     }, cursor ${cursor}`,
                // );
                return {
                    type: 'sync',
                    collection: cid,
                    deltas,
                    serverCursor: cursor,
                };
            } else {
                // console.log(`Nothing new for ${cid}`);
            }
        })
        .filter(Boolean);
};

export const onMessage = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
    message: ClientMessage<Delta, Data>,
): ?ServerMessage<Delta, Data> {
    if (message.type === 'sync') {
        const schemaChecker = state.getSchemaChecker(message.collection);
        if (!schemaChecker) {
            console.warn(`No schema found for ${message.collection}`);
            // TODO should I surface an error here? Break off the connection?
            return;
        }
        for (const delta of message.deltas) {
            const error = schemaChecker(delta.delta);
            if (error != null) {
                console.error(`Delta on ${delta.node} failed schema check! ${error}`);
                console.error(delta.delta);
                return;
            }
        }
        if (!state.clients[sessionId]) {
            state.clients[sessionId] = { collections: {} };
        }
        if (
            message.serverCursor != null ||
            state.clients[sessionId].collections[message.collection] == null
        ) {
            state.clients[sessionId].collections[message.collection] = message.serverCursor;
        }
        if (message.deltas.length) {
            state.persistence.addDeltas(message.collection, sessionId, message.deltas);
            let maxStamp = null;
            message.deltas.forEach(delta => {
                const stamp = state.crdt.deltas.stamp(delta.delta);
                if (maxStamp == null || stamp > maxStamp) {
                    maxStamp = stamp;
                }
            });
            // console.log('max', maxStamp, message.deltas);
            if (maxStamp) {
                console.log('acking');
                return {
                    type: 'ack',
                    deltaStamp: maxStamp,
                    collection: message.collection,
                };
            } else {
                console.log('no max stamp??');
            }
            // console.log('not acking');
        }
    } else if (message.type === 'ack') {
        console.log('acked');
        state.clients[sessionId].collections[message.collection] = message.serverCursor;
    }
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence<Delta, Data>,
    getSchemaChecker: string => ?(Delta) => ?string,
): ServerState<Delta, Data> => {
    return { crdt, persistence, getSchemaChecker, clients: {} };
};

export default make;
