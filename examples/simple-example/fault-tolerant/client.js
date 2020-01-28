// @flow

import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { ClientMessage, ServerMessage, CursorType } from './server.js';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/schema.js';

export type { CursorType } from './server.js';

export type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
    create: (v: any, stamp: string) => Data,
    createValue: (v: any, stamp: string) => Data,
    createDeepMap: (v: any, stamp: string) => Data,
    merge: (a: Data, b: Data) => Data,
    latestStamp: (a: Data) => string,
    value: (v: Data) => any,
    deltas: {
        remove: (stamp: string) => Delta,
        stamp: (delta: Delta) => string,
        set: (path: Array<string>, value: Data) => Delta,
        removeAt: (path: Array<string>, stamp: string) => Delta,
    },
};

// OK here we use idb.
// And maybe we use localstorage if we have an active connection, and then idb? But if I'm storing the data itself in idb, might as well be consistent.

// Yes, first pass, keep almost nothing in memory.

export type Persistence<Delta, Data> = {
    deltas(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    addDeltas(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
    ): Promise<void>,
    // setServerCursor(
    //     collection: string,
    //     serverCursor: CursorType,
    // ): Promise<void>,
    getServerCursor(collection: string): Promise<?CursorType>,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
    get<T>(collection: string, id: string): Promise<?T>,
    changeMany<T>(
        collection: string,
        ids: Array<string>,
        process: ({ [key: string]: T }) => void,
        serverCursor: ?CursorType,
        // hlc: HLC,
    ): Promise<{ [key: string]: T }>,
    // getMany<T>(collection: string, ids: Array<string>): Promise<Array<T>>,
    getAll<T>(collection: string): Promise<{ [key: string]: T }>,
};

// TODO store the HLC somewhere
type CollectionState<Delta, Data> = {
    hlc: HLC,
    // serverCursor: ?string,
    listeners: Array<(Array<{ value: ?any, id: string }>) => void>,
    itemListeners: { [key: string]: Array<(value: ?any) => void> },
};

export type Collection<T> = {
    save: (id: string, value: T) => Promise<void>,
    setAttribute: (
        id: string,
        full: T,
        key: string,
        value: any,
    ) => Promise<void>,
    load: (id: string) => Promise<?T>,
    loadAll: () => Promise<{ [key: string]: T }>,
    delete: (id: string) => void,
    onChanges: ((Array<{ value: ?T, id: string }>) => void) => () => void,
    onItemChange: (id: string, (value: ?T) => void) => () => void,
};

export type Backend = {
    getCollection: <T>(id: string) => Collection<T>,
    isConnected: () => boolean,
    getUsername: () => string,
    logout: () => void,
};

type Collections<Delta, Data> = {
    [collectionId: string]: CollectionState<Delta, Data>,
};

export type ClientState<Delta, Data> = {
    persistence: Persistence<Delta, Data>,
    collections: Collections<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    sessionId: string,
    setDirty: () => void,
};

const newCollection = <Delta, Data>(
    sessionId: string,
): CollectionState<Delta, Data> => ({
    hlc: hlc.init(sessionId, Date.now()),
    // serverCursor: null,
    listeners: [],
    itemListeners: {},
});

// The functions

export const debounce = function<T>(fn: () => void): () => void {
    let waiting = false;
    return items => {
        if (!waiting) {
            waiting = true;
            setTimeout(() => {
                fn();
                waiting = false;
            }, 0);
        } else {
            console.log('bouncing');
        }
    };
};

export const syncMessages = function<Delta, Data>(
    persistence: Persistence<Delta, Data>,
    collections: Collections<Delta, Data>,
): Promise<Array<ClientMessage<Delta, Data>>> {
    return Promise.all(
        Object.keys(collections).map(async (id: string): Promise<?ClientMessage<
            Delta,
            Data,
        >> => {
            const col = collections[id];
            const deltas = await persistence.deltas(id);
            const serverCursor = await persistence.getServerCursor(id);
            if (deltas.length || !serverCursor) {
                return {
                    type: 'sync',
                    collection: id,
                    serverCursor,
                    deltas: deltas.map(({ node, delta }) => ({ node, delta })),
                };
            }
        }),
    ).then(a => a.filter(Boolean));
};

// export const syncFailed = function<Delta, Data>(
//     collections: Collections<Delta, Data>,
// ) {
//     Object.keys(collections).forEach(id => {
//         const col = collections[id];
//         if (col.pendingDeltas.length) {
//             col.deltas = col.pendingDeltas.concat(col.deltas);
//             col.pendingDeltas = [];
//         }
//     });
// };

export const syncSucceeded = function<Delta, Data>(
    persistence: Persistence<Delta, Data>,
    collection: string,
    deltaKey: string,
) {
    return persistence.deleteDeltas(collection, deltaKey);
};

// This isn't quite as optimistic as it could be -- I could call the listeners
// before saving the data back into the database...
const applyDeltas = async function<Delta, Data>(
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    colid: string,
    col: CollectionState<Delta, Data>,
    deltas: Array<{ node: string, delta: Delta, ... }>,
    serverCursor: ?CursorType,
) {
    const changed = {};
    deltas.forEach(delta => {
        changed[delta.node] = true;
    });
    const data = await persistence.changeMany(
        colid,
        Object.keys(changed),
        data => {
            deltas.forEach(delta => {
                if (!data[delta.node]) {
                    data[delta.node] = crdt.createEmpty();
                }
                data[delta.node] = crdt.applyDelta(
                    data[delta.node],
                    delta.delta,
                );
            });
        },
        serverCursor,
    );

    if (col.listeners.length) {
        const changes = Object.keys(changed).map(id => ({
            id,
            value: crdt.value(data[id]),
        }));
        col.listeners.forEach(listener => {
            listener(changes);
        });
    }
    Object.keys(changed).forEach(id => {
        if (col.itemListeners[id]) {
            col.itemListeners[id].forEach(fn => fn(crdt.value(data[id])));
        }
    });
};

export const onMessage = async function<Delta, Data>(
    state: ClientState<Delta, Data>,
    msg: ServerMessage<Delta, Data>,
) {
    if (msg.type === 'sync') {
        if (!state.collections[msg.collection]) {
            state.collections[msg.collection] = newCollection(state.sessionId);
        }
        const col = state.collections[msg.collection];
        await applyDeltas(
            state.persistence,
            state.crdt,
            msg.collection,
            col,
            msg.deltas,
            msg.serverCursor,
        );
        let maxStamp = null;
        msg.deltas.forEach(delta => {
            const stamp = state.crdt.deltas.stamp(delta.delta);
            if (!maxStamp || stamp > maxStamp) {
                maxStamp = stamp;
            }
        });
        if (maxStamp) {
            col.hlc = hlc.recv(col.hlc, hlc.unpack(maxStamp), Date.now());
        }
        // } else if (msg.type === 'full') {
        //     if (!state.collections[msg.collection]) {
        //         state.collections[msg.collection] = newCollection(state.sessionId);
        //         // TODO find the latest hlc in here and update out hlc to match
        //         state.collections[msg.collection].data = msg.data;
        //     } else {
        //         const data = state.collections[msg.collection].data;
        //         Object.keys(msg.data).forEach(id => {
        //             if (data[id]) {
        //                 data[id] = state.crdt.merge(data[id], msg.data[id]);
        //             } else {
        //                 data[id] = msg.data[id];
        //             }
        //         });
        //     }
        //     const col = state.collections[msg.collection];

        //     if (col.listeners.length) {
        //         const changes = Object.keys(msg.data).map(id => ({
        //             id,
        //             value: state.crdt.value(col.data[id]),
        //         }));
        //         col.listeners.forEach(listener => {
        //             listener(changes);
        //         });
        //     }
        //     Object.keys(msg.data).forEach(id => {
        //         if (col.itemListeners[id]) {
        //             col.itemListeners[id].forEach(fn =>
        //                 fn(state.crdt.value(col.data[id])),
        //             );
        //         }
        //     });

        //     col.lastSeenDelta = msg.lastSeenDelta;
        //     let maxStamp = null;
        //     Object.keys(msg.data).forEach(id => {
        //         const stamp = state.crdt.latestStamp(msg.data[id]);
        //         if (!maxStamp || stamp > maxStamp) {
        //             maxStamp = stamp;
        //         }
        //     });
        //     if (maxStamp) {
        //         col.hlc = hlc.recv(col.hlc, hlc.unpack(maxStamp), Date.now());
        //     }
    } else if (msg.type === 'ack') {
        return state.persistence.deleteDeltas(msg.collection, msg.deltaStamp);
    }
};

export const getCollection = function<Delta, Data, T>(
    state: ClientState<Delta, Data>,
    key: string,
    schema: Schema,
): Collection<T> {
    if (!state.collections[key]) {
        state.collections[key] = newCollection(state.sessionId);
        state.setDirty();
    }
    const col = state.collections[key];
    const ts = () => {
        col.hlc = hlc.inc(col.hlc, Date.now());
        return hlc.pack(col.hlc);
    };
    return {
        save: async (id: string, value: T) => {
            validate(value, schema);
            const map = state.crdt.createDeepMap(value, ts());
            const delta = state.crdt.deltas.set([], map);
            await state.persistence.addDeltas(key, [
                { node: id, delta, stamp: state.crdt.deltas.stamp(delta) },
            ]);
            state.setDirty();
            await applyDeltas(
                state.persistence,
                state.crdt,
                key,
                col,
                [{ node: id, delta }],
                null,
            );
        },
        setAttribute: async (id: string, full: T, key: string, value: any) => {
            validateSet(schema, [key], value);
            const delta = state.crdt.deltas.set(
                [key],
                state.crdt.createValue(value, ts()),
            );
            // col.deltas.push({ node: id, delta });
            await state.persistence.addDeltas(key, [
                { node: id, delta, stamp: state.crdt.deltas.stamp(delta) },
            ]);
            state.setDirty();
            await applyDeltas(
                state.persistence,
                state.crdt,
                key,
                col,
                [{ node: id, delta }],
                null,
            );
        },
        load: async (id: string): Promise<?T> => {
            const data: ?Data = await state.persistence.get(key, id);
            return data ? state.crdt.value(data) : null;
        },
        loadAll: async () => {
            // console.log(state);
            const raw = await state.persistence.getAll(key);
            // console.log('raw', raw);
            const res = {};
            Object.keys(raw).forEach(id => {
                const v = state.crdt.value(raw[id]);
                if (v != null) {
                    res[id] = v;
                }
            });
            return res;
        },
        delete: (id: string) => {
            const delta = state.crdt.deltas.remove(ts());
            applyDeltas(state.persistence, state.crdt, key, col, [
                { node: id, delta },
            ]);
            return;
        },
        onChanges: (fn: (Array<{ value: ?T, id: string }>) => void) => {
            col.listeners.push(fn);
            return () => {
                col.listeners = col.listeners.filter(f => f !== fn);
            };
        },
        onItemChange: (id: string, fn: (value: ?T) => void) => {
            if (!col.itemListeners[id]) {
                col.itemListeners[id] = [];
            }
            col.itemListeners[id].push(fn);
            return () => {
                col.itemListeners[id] = col.itemListeners[id].filter(
                    f => f !== fn,
                );
                if (!col.itemListeners[id].length) {
                    delete col.itemListeners[id];
                }
            };
        },
    };
};

const make = <Delta, Data>(
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    sessionId: string,
    setDirty: () => void,
    initialCollections: Array<string> = [],
): ClientState<Delta, Data> => {
    const collections: {
        [collectionId: string]: CollectionState<Delta, Data>,
    } = {};

    initialCollections.forEach(
        name => (collections[name] = newCollection(sessionId)),
    );

    if (initialCollections.length) {
        setTimeout(() => setDirty(), 0);
    }

    return {
        persistence,
        collections,
        crdt,
        sessionId,
        setDirty,
    };
};

export default make;
