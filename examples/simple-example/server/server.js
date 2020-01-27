// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/lib/schema.js';

export type ClientMessage<Delta, Data> = {
    type: 'sync',
    collection: string,
    lastSeenDelta: number,
    deltas: Array<{ node: string, delta: Delta }>,
};

/*

Ok how to persist?
lets do the http client first
Current flow is:

-> sync/
   (with some new messages maybe)
   save that to disk

Easy mode:
- everything's still in memory, so responses can be fast
- but we just dump to disk, and then load at the start.

Hard mode:
- what if we want only a bit of data in memory? idk

 */

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

export type Persistence<Delta, Data> = {
    load(collection: string): Promise<Collection<Delta, Data>>,
    update(
        collection: string,
        startingIndex: number,
        deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
        items: Array<{ key: string, data: Data }>,
    ): Promise<void>,
    // addDeltas(
    //     collection: string,
    //     startingIndex: number,
    //     deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
    // ): void,
    // setItems(
    //     collection: string,
    //     items: Array<{ key: string, data: Data }>,
    // ): void,
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
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    getSchema: string => Schema,
    collections: {
        [collectionId: string]: Collection<Delta, Data>,
    },
    clients: {
        [sessionId: string]: {
            collections: {
                [collectionId: string]: number,
            },
            // send: ?(Array<ServerMessage<Delta, Data>>) => void,
        },
    },
};

const applyDeltas = function<Delta, Data>(
    schema: Schema,
    crdt: CRDTImpl<Delta, Data>,
    nodes: { [key: string]: Data },
    deltas: Array<{ node: string, delta: Delta }>,
) {
    const changed = {};
    deltas.forEach(delta => {
        if (!nodes[delta.node]) {
            nodes[delta.node] = crdt.createEmpty();
        }
        changed[delta.node] = true;
        nodes[delta.node] = crdt.applyDelta(nodes[delta.node], delta.delta);
    });
    return Object.keys(changed);
};

export const getMessages = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    sessionId: string,
): Array<ServerMessage<Delta, Data>> {
    if (!state.clients[sessionId]) {
        return [];
    }
    return Object.keys(state.clients[sessionId].collections)
        .map((cid: string): ?ServerMessage<Delta, Data> => {
            const col = state.collections[cid];
            const lastSeen = state.clients[sessionId].collections[cid];
            if (lastSeen === -1) {
                return {
                    type: 'full',
                    collection: cid,
                    data: col.data,
                    lastSeenDelta: col.deltas.length,
                };
            } else if (col.deltas.length > lastSeen) {
                const news = col.deltas
                    .slice(lastSeen)
                    .filter(delta => delta.sessionId !== sessionId);
                if (news.length) {
                    return {
                        type: 'sync',
                        collection: cid,
                        deltas: news.map(({ node, delta }) => ({
                            node,
                            delta,
                        })),
                        lastSeenDelta: col.deltas.length,
                    };
                }
            }
        })
        .filter(Boolean);
};

export const hasCollection = function<Delta, Data>(
    state: ServerState<Delta, Data>,
    col: string,
) {
    return !!state.collections[col];
};

export const loadCollection = async function<Delta, Data>(
    state: ServerState<Delta, Data>,
    collection: string,
): Promise<void> {
    if (state.collections[collection]) {
        return;
    }
    state.collections[collection] = await state.persistence.load(collection);
};

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
            message.lastSeenDelta;
        // collection: user/{id}/priv/colname
        // collection: user/{id}/pub/colname
        // TODO validate access to message.collection
        if (!state.collections[message.collection]) {
            throw new Error(
                `Server configuration error - need to load ${message.collection} before handling messages about it`,
            );
            // state.collections[message.collection] = { data: {}, deltas: [] };
        }
        const startingIndex =
            state.collections[message.collection].deltas.length;
        const deltas = message.deltas.map(item => ({ ...item, sessionId }));
        state.collections[message.collection].deltas.push(...deltas);

        // message.deltas.forEach(item => {
        //     state.collections[message.collection].deltas.push({
        //         ...item,
        //         sessionId: sessionId,
        //     });
        // });

        const changed = applyDeltas(
            schema,
            state.crdt,
            state.collections[message.collection].data,
            message.deltas,
        );
        state.persistence.update(
            message.collection,
            startingIndex,
            deltas,
            changed.map(key => ({
                key,
                data: state.collections[message.collection].data[key],
            })),
        );
    }
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence<Delta, Data>,
    getSchema: string => Schema,
): ServerState<Delta, Data> => {
    const collections: {
        [collectionId: string]: Collection<Delta, Data>,
    } = {};

    return { collections, crdt, persistence, getSchema, clients: {} };
};

export default make;
