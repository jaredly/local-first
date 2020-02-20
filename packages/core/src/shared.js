// @flow

import type { Collection, PeerChange } from './types';
import type {
    Persistence,
    OldNetwork,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
} from './types';
import {
    type Schema,
    validate,
    validateSet,
} from '../../nested-object-crdt/src/schema.js';
import type { HLC } from '../../hybrid-logical-clock';
import * as hlc from '../../hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';

export type CollectionState<Data, T> = {
    cache: { [key: string]: Data },
    listeners: Array<(Array<{ id: string, value: ?T }>) => mixed>,
    itemListeners: { [key: string]: Array<(?T) => mixed> },
};

export const newCollection = () => ({
    cache: {},
    listeners: [],
    itemListeners: {},
});

export type CRDTImpl<Delta, Data> = {
    merge(?Data, Data): Data,
    maxStamp(Data): ?string,
    value<T>(Data): T,
    deltas: {
        diff(?Data, Data): Delta,
        set(Array<string>, Data): Delta,
        remove(string): Delta,
        apply(?Data, Delta): Data,
        stamp(Delta): string,
    },
    createValue<T>(T, string): Data,
};

const send = <Data, T>(
    state: CollectionState<Data, T>,
    id: string,
    value: ?T,
) => {
    state.listeners.forEach(fn => fn([{ id, value }]));
    if (state.itemListeners[id]) {
        state.itemListeners[id].forEach(fn => fn(value));
    }
};

// This is the full version, non-patch I think?
// Ok I believe this also works with the patch version.
export const getCollection = function<Delta, Data, T>(
    colid: string,
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    getStamp: () => string,
    setDirty: () => void,
    sendCrossTabChanges: PeerChange => mixed,
    schema: Schema,
): Collection<T> {
    return {
        async save(id: string, node: T) {
            validate(node, schema);
            state.cache[id] = crdt.merge(
                state.cache[id],
                crdt.createValue(node, getStamp()),
            );
            send(state, id, node);
            const delta = crdt.deltas.set([], state.cache[id]);
            state.cache[id] = await persistence.applyDelta(
                colid,
                id,
                delta,
                crdt.deltas.stamp(delta),
                crdt.deltas.apply,
            );
            sendCrossTabChanges({ col: colid, nodes: [id] });
            setDirty();
        },

        async setAttribute(id: string, path: Array<string>, value: any) {
            validateSet(schema, path, value);
            const delta = crdt.deltas.set(
                path,
                crdt.createValue(value, getStamp()),
            );
            let plain = null;
            if (state.cache[id]) {
                state.cache[id] = crdt.deltas.apply(state.cache[id], delta);
                plain = crdt.value(state.cache[id]);
                send(state, id, plain);
            }
            const full = await persistence.applyDelta(
                colid,
                id,
                delta,
                crdt.deltas.stamp(delta),
                crdt.deltas.apply,
            );
            state.cache[id] = full;
            const newPlain = crdt.value(full);
            if (!deepEqual(plain, newPlain)) {
                send(state, id, newPlain);
            }
            sendCrossTabChanges({ col: colid, nodes: [id] });
            setDirty();
        },

        async load(id: string) {
            const v = await persistence.load(colid, id);
            if (!v) {
                return null;
            }
            state.cache[id] = v;
            return crdt.value(v);
        },
        async loadAll() {
            const all = await persistence.loadAll(colid);
            const res = {};
            Object.keys(all).forEach(id => {
                state.cache[id] = all[id];
                res[id] = crdt.value(all[id]);
            });
            return res;
        },
        async delete(id: string) {
            delete state.cache[id];
            send(state, id, null);
            const stamp = getStamp();
            await persistence.applyDelta(
                colid,
                id,
                crdt.deltas.remove(stamp),
                stamp,
                crdt.deltas.apply,
            );
            sendCrossTabChanges({ col: colid, nodes: [id] });
            setDirty();
        },

        onChanges(fn: (Array<{ id: string, value: ?T }>) => void) {
            state.listeners.push(fn);
            return () => {
                state.listeners = state.listeners.filter(f => f !== fn);
            };
        },

        onItemChange(id: string, fn: (?T) => void) {
            if (!state.itemListeners[id]) {
                state.itemListeners[id] = [fn];
            } else {
                state.itemListeners[id].push(fn);
            }
            return () => {
                if (!state.itemListeners[id]) {
                    return;
                }
                state.itemListeners[id] = state.itemListeners[id].filter(
                    f => f !== fn,
                );
            };
        },
    };
};

export const onCrossTabChanges = async function<Delta, Data, T>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    colid: string,
    nodes: Array<string>,
) {
    const values = {};
    await Promise.all(
        nodes.map(async id => {
            const v = await persistence.load(colid, id);
            if (v) {
                state.cache[id] = v;
                values[id] = crdt.value(v);
            } else {
                delete state.cache[id];
            }
        }),
    );
    state.listeners.forEach(fn =>
        fn(nodes.map(id => ({ id, value: values[id] }))),
    );
    nodes.forEach(id => {
        if (state.itemListeners[id]) {
            state.itemListeners[id].forEach(fn => fn(values[id]));
        }
    });
};
