// @flow

import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { ClientMessage, ServerMessage } from '../../server/server.js';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/schema.js';

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

type CollectionState<Delta, Data> = {
    hlc: HLC,
    data: { [key: string]: Data },
    lastSeenDelta: number,
    deltas: Array<{ node: string, delta: Delta }>,
    pendingDeltas: Array<{ node: string, delta: Delta }>,
    listeners: Array<(Array<{ value: ?any, id: string }>) => void>,
    itemListeners: { [key: string]: Array<(value: ?any) => void> },
};

const newCollection = <Delta, Data>(
    sessionId: string,
): CollectionState<Delta, Data> => ({
    hlc: hlc.init(sessionId, Date.now()),
    data: {},
    deltas: [],
    pendingDeltas: [],
    lastSeenDelta: -1, // means it hasn't been synced at all yet
    listeners: [],
    itemListeners: {},
});

export type Collection<T> = {
    save: (id: string, value: T) => void,
    setAttribute: (id: string, full: T, key: string, value: any) => void,
    load: (id: string) => ?T,
    loadAll: () => { [key: string]: T },
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
    collections: Collections<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    sessionId: string,
    setDirty: () => void,
};

// The functions

export const debounce = function<T>(fn: () => void): () => void {
    let waiting = false;
    return items => {
        if (!waiting) {
            waiting = true;
            setTimeout(() => {
                console.log('ok');
                fn();
                waiting = false;
            }, 0);
        } else {
            console.log('bouncing');
        }
    };
};

export const syncMessages = function<Delta, Data>(
    collections: Collections<Delta, Data>,
): Array<ClientMessage<Delta, Data>> {
    return Object.keys(collections)
        .map(id => {
            const col = collections[id];
            if (col.lastSeenDelta === -1 || col.deltas.length) {
                col.pendingDeltas = col.deltas;
                col.deltas = [];
                return {
                    type: 'sync',
                    collection: id,
                    lastSeenDelta: col.lastSeenDelta,
                    deltas: col.pendingDeltas,
                };
            }
        })
        .filter(Boolean);
};

export const syncFailed = function<Delta, Data>(
    collections: Collections<Delta, Data>,
) {
    Object.keys(collections).forEach(id => {
        const col = collections[id];
        if (col.pendingDeltas.length) {
            col.deltas = col.pendingDeltas.concat(col.deltas);
            col.pendingDeltas = [];
        }
    });
};

export const syncSucceeded = function<Delta, Data>(
    collections: Collections<Delta, Data>,
) {
    Object.keys(collections).forEach(id => {
        const col = collections[id];
        if (col.pendingDeltas.length) {
            col.pendingDeltas = [];
        }
    });
};

const applyDeltas = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    col: CollectionState<Delta, Data>,
    deltas: Array<{ node: string, delta: Delta, ... }>,
) => {
    const changed = {};
    deltas.forEach(delta => {
        if (!col.data[delta.node]) {
            col.data[delta.node] = crdt.createEmpty();
        }
        changed[delta.node] = true;
        col.data[delta.node] = crdt.applyDelta(
            col.data[delta.node],
            delta.delta,
        );
    });
    if (col.listeners.length) {
        const changes = Object.keys(changed).map(id => ({
            id,
            value: crdt.value(col.data[id]),
        }));
        col.listeners.forEach(listener => {
            listener(changes);
        });
    }
    Object.keys(changed).forEach(id => {
        if (col.itemListeners[id]) {
            col.itemListeners[id].forEach(fn => fn(crdt.value(col.data[id])));
        }
    });
};

export const onMessage = function<Delta, Data>(
    state: ClientState<Delta, Data>,
    msg: ServerMessage<Delta, Data>,
) {
    if (msg.type === 'sync') {
        if (!state.collections[msg.collection]) {
            state.collections[msg.collection] = newCollection(state.sessionId);
        }
        const col = state.collections[msg.collection];
        applyDeltas(state.crdt, col, msg.deltas);
        col.lastSeenDelta = msg.lastSeenDelta;
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
    } else if (msg.type === 'full') {
        if (!state.collections[msg.collection]) {
            state.collections[msg.collection] = newCollection(state.sessionId);
            // TODO find the latest hlc in here and update out hlc to match
            state.collections[msg.collection].data = msg.data;
        } else {
            const data = state.collections[msg.collection].data;
            Object.keys(msg.data).forEach(id => {
                if (data[id]) {
                    data[id] = state.crdt.merge(data[id], msg.data[id]);
                } else {
                    data[id] = msg.data[id];
                }
            });
        }
        const col = state.collections[msg.collection];

        if (col.listeners.length) {
            const changes = Object.keys(msg.data).map(id => ({
                id,
                value: state.crdt.value(col.data[id]),
            }));
            col.listeners.forEach(listener => {
                listener(changes);
            });
        }
        Object.keys(msg.data).forEach(id => {
            if (col.itemListeners[id]) {
                col.itemListeners[id].forEach(fn =>
                    fn(state.crdt.value(col.data[id])),
                );
            }
        });

        col.lastSeenDelta = msg.lastSeenDelta;
        let maxStamp = null;
        Object.keys(msg.data).forEach(id => {
            const stamp = state.crdt.latestStamp(msg.data[id]);
            if (!maxStamp || stamp > maxStamp) {
                maxStamp = stamp;
            }
        });
        if (maxStamp) {
            col.hlc = hlc.recv(col.hlc, hlc.unpack(maxStamp), Date.now());
        }
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
        save: (id: string, value: T) => {
            validate(value, schema);
            const map = state.crdt.createDeepMap(value, ts());
            const delta = state.crdt.deltas.set([], map);
            col.deltas.push({ node: id, delta });
            state.setDirty();
            applyDeltas(state.crdt, col, [{ node: id, delta }]);
        },
        setAttribute: (id: string, full: T, key: string, value: any) => {
            validateSet(schema, [key], value);
            const delta = state.crdt.deltas.set(
                [key],
                state.crdt.createValue(value, ts()),
            );
            col.deltas.push({ node: id, delta });
            state.setDirty();
            applyDeltas(state.crdt, col, [{ node: id, delta }]);
        },
        load: (id: string) => {
            return state.crdt.value(col.data[id]);
        },
        loadAll: () => {
            const res = {};
            Object.keys(col.data).forEach(id => {
                const v = state.crdt.value(col.data[id]);
                if (v != null) {
                    res[id] = v;
                }
            });
            return res;
        },
        delete: (id: string) => {
            const delta = state.crdt.deltas.remove(ts());
            applyDeltas(state.crdt, col, [{ node: id, delta }]);
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
        collections,
        crdt,
        sessionId,
        setDirty,
    };
};

export default make;
