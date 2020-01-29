// @flow

import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { ClientMessage, ServerMessage, CursorType } from './server.js';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/schema.js';
import type { Persistence } from './clientTypes.js';

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

type CollectionState<Delta, Data> = {
    cache: { [key: string]: Data },
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
    hlc: HLC,
    persistence: Persistence<Delta, Data>,
    collections: Collections<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    listeners: Array<({ col: string, nodes: Array<string> }) => void>,
    setDirty: () => void,
};

const newCollection = <Delta, Data>(): CollectionState<Delta, Data> => ({
    cache: {},
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
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    return Promise.all(
        Object.keys(collections).map(async (id: string): Promise<?ClientMessage<
            Delta,
            Data,
        >> => {
            const col = collections[id];
            const deltas = await persistence.deltas(id);
            const serverCursor = await persistence.getServerCursor(id);
            if (deltas.length || !serverCursor || reconnected) {
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

const optimisticUpdates = function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    colid: string,
    col: CollectionState<Delta, Data>,
    deltas: Array<{ node: string, delta: Delta, ... }>,
    cache: { [key: string]: Data },
) {
    // Optimistic updates yall!
    const changed = {};
    deltas.forEach(delta => {
        changed[delta.node] = true;
        if (cache[delta.node]) {
            cache[delta.node] = crdt.applyDelta(cache[delta.node], delta.delta);
        }
    });
    if (col.listeners.length) {
        const changes = Object.keys(changed)
            .map(id =>
                cache[id]
                    ? {
                          id,
                          value: crdt.value(cache[id]),
                      }
                    : null,
            )
            .filter(Boolean);
        col.listeners.forEach(listener => {
            listener(changes);
        });
    }
    Object.keys(changed).forEach(id => {
        if (cache[id] && col.itemListeners[id]) {
            col.itemListeners[id].forEach(fn => fn(crdt.value(cache[id])));
        }
    });
};

// This isn't quite as optimistic as it could be -- I could call the listeners
// before saving the data back into the database...
const applyDeltas = async function<Delta, Data>(
    client: ClientState<Delta, Data>,
    colid: string,
    col: CollectionState<Delta, Data>,
    deltas: Array<{ node: string, delta: Delta, ... }>,
    // TODO these last three could be sent in tandem.
    // like {type: 'server', cursor: CursorType} | {type: 'local', cache: Cache}
    source:
        | { type: 'server', cursor: ?CursorType }
        | { type: 'local', cache: { [key: string]: Data } },
    // serverCursor: ?CursorType,
    // cache: ?{ [key: string]: Data },
    // local: boolean,
) {
    const changed = {};
    deltas.forEach(delta => {
        changed[delta.node] = true;
    });

    if (source.type === 'local') {
        optimisticUpdates(client.crdt, colid, col, deltas, source.cache);

        // TODO ideally adding the deltas and applying the deltas would happen in the same transaction....
        await client.persistence.addDeltas(
            colid,
            deltas.map(delta => ({
                ...delta,
                stamp: client.crdt.deltas.stamp(delta.delta),
            })),
        );
        client.setDirty();
    }

    const changedIds = Object.keys(changed);
    console.log('Applying deltas', changedIds, deltas.length);

    const data = await client.persistence.changeMany(
        colid,
        changedIds,
        data => {
            deltas.forEach(delta => {
                if (!data[delta.node]) {
                    data[delta.node] = client.crdt.createEmpty();
                }
                data[delta.node] = client.crdt.applyDelta(
                    data[delta.node],
                    delta.delta,
                );
            });
        },
        source.type === 'server' ? source.cursor : null,
    );

    if (col.listeners.length) {
        const changes = changedIds.map(id => ({
            id,
            value: client.crdt.value(data[id]),
        }));
        col.listeners.forEach(listener => {
            listener(changes);
        });
    }
    changedIds.forEach(id => {
        // Only update the cache if the node has already been cached
        if (source.type === 'local' && source.cache[id]) {
            source.cache[id] = data[id];
        }
        if (col.itemListeners[id]) {
            col.itemListeners[id].forEach(fn =>
                fn(client.crdt.value(data[id])),
            );
        }
    });
    if (client.listeners.length && changedIds.length) {
        console.log('Broadcasting to client-level listeners', changedIds);
        client.listeners.forEach(fn => fn({ col: colid, nodes: changedIds }));
    }
};

export const onMessage = async function<Delta, Data>(
    state: ClientState<Delta, Data>,
    msg: ServerMessage<Delta, Data>,
) {
    if (msg.type === 'sync') {
        if (!state.collections[msg.collection]) {
            state.collections[msg.collection] = newCollection();
        }
        const col = state.collections[msg.collection];
        await applyDeltas(state, msg.collection, col, msg.deltas, {
            type: 'server',
            cursor: msg.serverCursor,
        });
        let maxStamp = null;
        msg.deltas.forEach(delta => {
            const stamp = state.crdt.deltas.stamp(delta.delta);
            if (!maxStamp || stamp > maxStamp) {
                maxStamp = stamp;
            }
        });
        if (maxStamp) {
            state.hlc = hlc.recv(state.hlc, hlc.unpack(maxStamp), Date.now());
            state.persistence.saveHLC(state.hlc);
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

export const getStamp = function<Delta, Data>(
    state: ClientState<Delta, Data>,
): string {
    state.hlc = hlc.inc(state.hlc, Date.now());
    state.persistence.saveHLC(state.hlc);
    return hlc.pack(state.hlc);
};

export const receiveCrossTabChanges = async function<Delta, Data>(
    client: ClientState<Delta, Data>,
    changes: { col: string, nodes: Array<string> },
) {
    if (!client.collections[changes.col]) {
        return;
    }
    const col = client.collections[changes.col];
    const res = {};
    await Promise.all(
        changes.nodes
            .filter(
                id =>
                    col.listeners.length ||
                    !!col.cache[id] ||
                    col.itemListeners[id],
            )
            .map(id =>
                client.persistence.get(changes.col, id).then(data => {
                    if (data) {
                        res[id] = client.crdt.value(data);
                        if (col.cache[id]) {
                            col.cache[id] = data;
                        }
                    } else {
                        console.log('Cross Tab value missing', id);
                    }
                }),
            ),
    );

    if (col.listeners.length) {
        const changedNodes = changes.nodes.map(id => ({
            id,
            value: res[id],
        }));
        col.listeners.forEach(listener => {
            listener(changedNodes);
        });
    }
    changes.nodes.forEach(id => {
        if (col.itemListeners[id]) {
            col.itemListeners[id].forEach(fn => fn(res[id]));
        }
    });
};

export const getCollection = function<Delta, Data, T>(
    state: ClientState<Delta, Data>,
    key: string,
    schema: Schema,
): Collection<T> {
    if (!state.collections[key]) {
        state.collections[key] = newCollection();
        state.setDirty();
    }
    const col = state.collections[key];
    return {
        save: async (id: string, value: T) => {
            validate(value, schema);
            const map = state.crdt.createDeepMap(value, getStamp(state));
            const delta = state.crdt.deltas.set([], map);
            await applyDeltas(state, key, col, [{ node: id, delta }], {
                type: 'local',
                cache: col.cache,
            });
        },
        setAttribute: async (id: string, full: T, key: string, value: any) => {
            validateSet(schema, [key], value);
            const delta = state.crdt.deltas.set(
                [key],
                state.crdt.createValue(value, getStamp(state)),
            );
            await applyDeltas(state, key, col, [{ node: id, delta }], {
                type: 'local',
                cache: col.cache,
            });
        },
        load: async (id: string): Promise<?T> => {
            const data: ?Data = await state.persistence.get(key, id);
            if (data) {
                col.cache[id] = data;
            }
            return data ? state.crdt.value(data) : null;
        },
        loadAll: async () => {
            const raw = await state.persistence.getAll(key);
            const res = {};
            Object.keys(raw).forEach(id => {
                col.cache[id] = raw[id];
                const v = state.crdt.value(raw[id]);
                if (v != null) {
                    res[id] = v;
                }
            });
            return res;
        },
        delete: (id: string) => {
            const delta = state.crdt.deltas.remove(getStamp(state));
            applyDeltas(state, key, col, [{ node: id, delta }], {
                type: 'local',
                cache: col.cache,
            });
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
    setDirty: () => void,
    initialCollections: Array<string> = [],
): ClientState<Delta, Data> => {
    const collections: {
        [collectionId: string]: CollectionState<Delta, Data>,
    } = {};

    initialCollections.forEach(name => (collections[name] = newCollection()));

    const state = {
        hlc: persistence.getHLC(),
        persistence,
        collections,
        listeners: [],
        crdt,
        setDirty,
    };

    if (initialCollections.length) {
        setTimeout(() => state.setDirty(), 0);
    }
    return state;
};

export default make;
