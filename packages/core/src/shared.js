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
        insert(Data, Array<string | number>, number, string, Data, string): Delta,
        reorderRelative(
            Data,
            path: Array<string | number>,
            childId: string,
            relativeTo: string,
            before: boolean,
            stamp: string,
        ): Delta,
        // $FlowFixMe
        other<Other>(Data, Array<string | number>, Other, string): Delta,
        apply(Data, Delta): Data,
        stamp(Delta): string,
        invert(Data, Delta, () => string): ?Delta,
        restamp(Delta, string): Delta,
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
): Collection<T> {
    const applyDelta = async (id: string, delta: Delta, sendNew?: boolean, skipUndo) => {
        let plain = null;

        if (undoManager && !skipUndo) {
            const inverted =
                state.cache[id] == null
                    ? crdt.deltas.replace(crdt.createEmpty(getStamp()))
                    : crdt.deltas.invert(state.cache[id], delta, getStamp);
            if (inverted != null) {
                undoManager.add(() => {
                    // console.log('undoing', inverted);
                    applyDelta(id, crdt.deltas.restamp(inverted, getStamp()), false, true);
                });
            } else {
                console.log(`Unable to invert delta: undo will be skipped`);
            }
        }

        if (state.cache[id] != null || sendNew) {
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
        // Updaters
        async save(id: string, node: T) {
            validate(node, schema);
            // NOTE this overwrites everything, setAttribute will do much better merges
            const delta = crdt.deltas.replace(crdt.createValue(node, getStamp(), getStamp, schema));
            applyDelta(id, delta, true);
        },

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
            const delta = crdt.deltas.set(state.cache[id], path, crdt.createEmpty(getStamp()));
            return applyDelta(id, delta);
        },

        async removeId(id: string, path: Array<string | number>, childId: string) {
            const sub = subSchema(schema, path);

            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }

            const stamp = getStamp();
            const delta = crdt.deltas.set(
                state.cache[id],
                path.concat([childId]),
                crdt.createEmpty(getStamp()),
            );
            return applyDelta(id, delta);
        },

        async reorderIdRelative(
            id: string,
            path: Array<string | number>,
            childId: string,
            relativeTo: string,
            before: boolean,
        ) {
            const sub = subSchema(schema, path);

            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }

            const stamp = getStamp();
            const delta = crdt.deltas.reorderRelative(
                state.cache[id],
                path,
                childId,
                relativeTo,
                before,
                stamp,
            );

            return applyDelta(id, delta);
        },

        // async reorderId(id: string, path: Array<string | number>, childId: string, newIdx: number) {
        //     const sub = subSchema(schema, path);

        //     if (state.cache[id] == null) {
        //         throw new Error(
        //             `As reorder is data-sensitive, we need to have the data cached before we call this`,
        //         );
        //         // const stored = await persistence.load(colid, id);
        //         // if (!stored) {
        //         //     throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
        //         // }
        //         // state.cache[id] = stored;
        //     }
        // },

        async insertId(id: string, path: Array<string | number>, idx: number, childId: string) {
            // const sub = subSchema(schema, path);

            if (state.cache[id] == null) {
                const stored = await persistence.load(colid, id);
                if (!stored) {
                    throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                }
                state.cache[id] = stored;
            }

            const stamp = getStamp();
            const delta = crdt.deltas.insert(
                state.cache[id],
                path,
                idx,
                childId,
                crdt.createValue(childId, stamp, getStamp, 'string'),
                stamp,
            );

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
            const delta = crdt.deltas.set(
                state.cache[id],
                path,
                crdt.createValue(value, getStamp(), getStamp, sub),
            );
            return applyDelta(id, delta);
        },

        async delete(id: string) {
            const stamp = getStamp();

            if (undoManager) {
                if (state.cache[id] == null) {
                    const stored = await persistence.load(colid, id);
                    if (!stored) {
                        throw new Error(`Cannot set attribute, node with id ${id} doesn't exist`);
                    }
                    state.cache[id] = stored;
                }

                const inverted = crdt.deltas.invert(
                    state.cache[id],
                    crdt.deltas.remove(stamp),
                    getStamp,
                );
                if (inverted != null) {
                    undoManager.add(() => {
                        applyDelta(id, crdt.deltas.restamp(inverted, getStamp()), false, true);
                    });
                } else {
                    console.log(`Unable to invert delta: undo will be skipped`);
                }
            }

            delete state.cache[id];
            send(state, id, null);
            const delta = crdt.deltas.remove(stamp);

            await persistence.applyDelta(colid, id, delta, stamp, crdt.deltas.apply);
            sendCrossTabChanges({ col: colid, nodes: [id] });
            setDirty();
        },

        // Getters
        genId: getStamp,

        getCached: (id: string) => {
            return state.cache[id] != null ? crdt.value(state.cache[id]) : null;
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
            // Why isn't this being loaded correctly?
            Object.keys(all).forEach(id => {
                state.cache[id] = all[id];
                const v = crdt.value(all[id]);
                // STOPSHIP there should be a `crdt.isEmpty` or something
                // to allow true null values if we want them
                if (v != null) {
                    res[id] = v;
                }
            });
            return res;
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
