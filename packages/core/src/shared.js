// @flow

import type { Collection, PeerChange, Export } from './types';
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
    type Type as SchemaType,
    validate,
    validateSet,
    subSchema,
} from '../../nested-object-crdt/src/schema.js';
import type { HLC } from '../../hybrid-logical-clock';
import * as hlc from '../../hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';

export const fullExport = async function<Data>(persistence: Persistence): Export<Data> {
    const dump = {};
    await Promise.all(
        persistence.collections.map(async colid => {
            // const items = await (await db).getAll(colid + ':nodes');
            dump[colid] = await persistence.loadAll(colid);
        }),
    );
    return dump;
};

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

export type UndoManager = {
    add(() => mixed): void,
    undo(): void,
};

export type CRDTImpl<Delta, Data> = {
    merge(?Data, Data): Data,
    latestStamp(Data): ?string,
    value<T>(Data): T,
    get(Data, Array<string | number>): ?Data,
    deltas: {
        diff(?Data, Data): Delta,
        set(Data, Array<string | number>, Data): Delta,
        replace(Data): Delta,
        remove(string): Delta,
        // $FlowFixMe
        other<Other>(Data, Array<string | number>, Other, string): Delta,
        apply(Data, Delta): Data,
        stamp(Delta): string,
    },
    createValue<T>(T, string, () => string, SchemaType): Data,
    createEmpty(string): Data,
};

const send = <Data, T>(state: CollectionState<Data, T>, id: string, value: ?T) => {
    state.listeners.forEach(fn => fn([{ id, value }]));
    if (state.itemListeners[id]) {
        state.itemListeners[id].forEach(fn => fn(value));
    }
};

// This is the full version, non-patch I think?
// Ok I believe this also works with the patch version.
export const getCollection = function<Delta, Data, RichTextDelta, T>(
    colid: string,
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    getStamp: () => string,
    setDirty: () => void,
    sendCrossTabChanges: PeerChange => mixed,
    schema: Schema,
    undoManager?: UndoManager,
    // undoManager or some such
): Collection<T> {
    const applyDelta = async (id: string, delta) => {
        let plain = null;
        if (state.cache[id] != null) {
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
    };
    return {
        async save(id: string, node: T) {
            validate(node, schema);
            // NOTE this overwrites everything, setAttribute will do much better merges
            if (undoManager) {
                const prev = state.cache[id] != null ? crdt.value(state.cache[id]) : null;
                undoManager.add(() => this.save(id, prev));
            }
            state.cache[id] = crdt.merge(
                state.cache[id],
                // STOPSHIP here's the bit
                // TODO use a schema folks, so we know what should be the rich-text-crdt for example.
                crdt.createValue(node, getStamp(), getStamp, schema),
            );
            send(state, id, node);
            const delta = crdt.deltas.replace(state.cache[id]);
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

        genId: getStamp,

        async applyRichTextDelta(id: string, path: Array<string | number>, delta: RichTextDelta) {
            const sub = subSchema(schema, path);
            if (sub !== 'rich-text') {
                throw new Error(`Schema at path is not a rich-text`);
            }
            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }
            const hostDelta = crdt.deltas.other(state.cache[id], path, delta, getStamp());
            return applyDelta(id, hostDelta);
        },

        async clearAttribute(id: string, path: Array<string | number>) {
            const sub = subSchema(schema, path);
            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }
            if (undoManager) {
                const prev = crdt.get(state.cache[id], path);
                undoManager.add(() => {
                    const delta = crdt.deltas.set(
                        state.cache[id],
                        path,
                        prev != null
                            ? crdt.createValue(crdt.value(prev), getStamp(), getStamp, sub)
                            : crdt.createEmpty(getStamp()),
                    );
                    return applyDelta(id, delta);
                });
            }
            const delta = crdt.deltas.set(state.cache[id], path, crdt.createEmpty(getStamp()));
            return applyDelta(id, delta);
        },

        async setAttribute(id: string, path: Array<string | number>, value: any) {
            const sub = subSchema(schema, path);
            validate(value, sub);
            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }
            if (undoManager) {
                const prev = crdt.get(state.cache[id], path);
                undoManager.add(() => {
                    const delta = crdt.deltas.set(
                        state.cache[id],
                        path,
                        prev != null
                            ? crdt.createValue(crdt.value(prev), getStamp(), getStamp, sub)
                            : crdt.createEmpty(getStamp()),
                    );
                    return applyDelta(id, delta);
                });
            }
            const delta = crdt.deltas.set(
                state.cache[id],
                path,
                crdt.createValue(value, getStamp(), getStamp, sub),
            );
            return applyDelta(id, delta);
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
                state.itemListeners[id] = state.itemListeners[id].filter(f => f !== fn);
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
    state.listeners.forEach(fn => fn(nodes.map(id => ({ id, value: values[id] }))));
    nodes.forEach(id => {
        if (state.itemListeners[id]) {
            state.itemListeners[id].forEach(fn => fn(values[id]));
        }
    });
};
