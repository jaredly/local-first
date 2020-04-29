// @flow
import type { Meta, HostDelta, CRDT, Delta, OtherMerge } from './types';
import { latestStamp } from './utils';
import * as sortedArray from './array-utils';
import { createEmpty } from './create';

export const restampMeta = function<Other>(meta: Meta<Other>, hlcStamp: string): Meta<Other> {
    switch (meta.type) {
        case 'plain':
            return { ...meta, hlcStamp };
        case 'other':
            return { ...meta, hlcStamp };
        case 'map':
            return { ...meta, hlcStamp };
        case 't':
            return { ...meta, hlcStamp };
        case 'array':
            return { ...meta, hlcStamp };
    }
    return meta;
};

export const restamp = function<T, Other, OtherDelta>(
    delta: Delta<T, Other, OtherDelta>,
    newStamp: string,
): Delta<T, Other, OtherDelta> {
    if (delta.type === 'set') {
        return {
            ...delta,
            value: {
                ...delta.value,
                meta: restampMeta(delta.value.meta, newStamp),
            },
        };
    }
    return delta;
};

// Return something undoable!
export const invert = function<T, D, Other, OtherDelta>(
    crdt: CRDT<T, Other>,
    delta: Delta<D, Other, OtherDelta>,
    getStamp: () => string,
    invertOtherDelta: OtherDelta => ?OtherDelta,
): ?Delta<?D, Other, OtherDelta> {
    // umm not sure how to get the stamp right
    // oh maybe I'll use a special sigil stamp "<latest>" or something
    // and then go through and replace
    if (delta.type === 'set') {
        let current = get(
            crdt,
            delta.path.map(k => k.key),
        );
        if (current == null) {
            current = createEmpty();
        }
        // $FlowFixMe
        return { type: 'set', path: delta.path, value: current };
    } else if (delta.type === 'insert') {
        const parentPath = delta.path.slice(0, -1);
        const id = delta.path[delta.path.length - 1].key;
        const parent = get(
            crdt,
            parentPath.map(k => k.key),
        );
        if (!parent || parent.meta.type !== 'array') {
            throw new Error(`Invalid insert operation`);
        }
        if (parent.meta.items[id]) {
            // STOPSHIP the stamps might be wrong in the keypath!
            return { type: 'reorder', path: delta.path, sort: parent.meta.items[id].sort };
        } else {
            return { type: 'set', path: delta.path, value: createEmpty() };
        }
    } else if (delta.type === 'reorder') {
        const parentPath = delta.path.slice(0, -1);
        const id = delta.path[delta.path.length - 1].key;
        const parent = get(
            crdt,
            parentPath.map(k => k.key),
        );
        if (!parent || parent.meta.type !== 'array') {
            throw new Error(`Invalid insert operation`);
        }
        if (parent.meta.items[id]) {
            // STOPSHIP the stamps might be wrong in the keypath!
            return { type: 'reorder', path: delta.path, sort: parent.meta.items[id].sort };
        } else {
            throw new Error(`Can't reorder something that's not there ${id}`);
        }
    } else if (delta.type === 'other') {
        const inverted = invertOtherDelta(delta.delta);
        if (inverted == null) {
            return null;
        }
        return {
            type: 'other',
            path: delta.path,
            delta: inverted,
            stamp: delta.stamp,
        };
    }
};

export const get = function<T, O, Other>(crdt: CRDT<T, Other>, path: Array<string | number>) {
    if (path.length === 0) {
        return crdt;
    }
    const key = path[0];
    if (crdt.meta.type === 'map') {
        return get(
            // $FlowFixMe
            { value: crdt.value[key], meta: crdt.meta.map[key] },
            path.slice(1),
        );
    }
    if (crdt.meta.type === 'array') {
        if (typeof key === 'string') {
            if (crdt.meta.items[key]) {
                return get(
                    {
                        meta: crdt.meta.items[key].meta,
                        // $FlowFixMe
                        value: crdt.value[crdt.meta.idsInOrder.indexOf(key)],
                    },
                    path.slice(1),
                );
            }
            return null;
        }
        if (typeof key !== 'number') {
            throw new Error(`Must use a numeric index`);
        }
        return get(
            {
                // $FlowFixMe
                value: crdt.value[key],
                meta: crdt.meta.items[crdt.meta.idsInOrder[key]].meta,
            },
            path.slice(1),
        );
    }
    throw new Error(`Can't get a sub item of a ${crdt.meta.type}`);
};

const makeKeyPath = function<T, Other>(current: Meta<Other>, path: Array<string | number>) {
    return path.map((item, i) => {
        if (!current) {
            throw new Error(`Invalid key path - doesn't represent the current state of things.`);
        }
        const stamp = current.hlcStamp;
        if (current.type === 'array') {
            if (typeof item === 'number') {
                if (current.type !== 'array') {
                    throw new Error(`Cannot get a number ${item} of a ${current.type}`);
                }
                const key = current.idsInOrder[item];
                if (!key) {
                    throw new Error(`Invalid index ${item}`);
                }
                current = current.items[key].meta;
                return { stamp, key };
            } else {
                if (current.items[item]) {
                    // throw new Error(`Invalid array id ${item}`);
                    current = current.items[item].meta;
                } else {
                    // $FlowFixMe
                    current = null;
                }
                return { stamp, key: item };
            }
        } else if (current.type === 'map') {
            if (typeof item === 'number') {
                throw new Error(`Cannot get a numeric index ${item} of a map`);
            }
            current = current.map[item];
            return { stamp, key: item };
        } else {
            throw new Error(`Can't get a sub-item ${item} of a ${current.type}`);
        }
    });
};

export const deltas = {
    diff<T, Other>(one: ?CRDT<T, Other>, two: CRDT<T, Other>) {
        if (!one) {
            return { type: 'set', path: [], value: two };
        }
        // TODO something a little more intelligent probably?
        return { type: 'set', path: [], value: one };
    },
    stamp<T, Other, OtherDelta>(
        delta: Delta<T, Other, OtherDelta>,
        otherStamp: Other => ?string,
    ): string {
        return delta.type === 'set'
            ? latestStamp(delta.value, otherStamp)
            : delta.type === 'other'
            ? delta.stamp
            : delta.sort.stamp;
    },
    other<T, Other, OtherDelta>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        delta: OtherDelta,
        stamp: string,
    ): Delta<T, Other, OtherDelta> {
        return {
            type: 'other',
            path: makeKeyPath(current.meta, path),
            delta,
            stamp,
        };
    },
    replace<T, Other>(value: CRDT<T, Other>): HostDelta<T, Other> {
        return {
            type: 'set',
            path: [],
            value,
        };
    },
    set<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        value: CRDT<T, Other>,
    ): HostDelta<T, Other> {
        return {
            type: 'set',
            path: makeKeyPath(current.meta, path),
            value,
        };
    },
    insert<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        idx: number,
        id: string,
        value: CRDT<T, Other>,
        stamp: string,
    ): HostDelta<T, Other> {
        const array = get(current, path);
        if (!array || array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array ? array.meta.type : 'null'}`,
            );
        }
        const meta = array.meta;
        const sort = {
            stamp,
            idx: sortedArray.sortForInsertion(meta.idsInOrder, id => meta.items[id].sort.idx, idx),
        };
        return {
            type: 'insert',
            path: makeKeyPath(current.meta, path.concat([id])),
            sort,
            value,
        };
    },
    insertRelative<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        id: string,
        relativeTo: string,
        before: boolean,
        value: CRDT<T, Other>,
        stamp: string,
    ): HostDelta<T, Other> {
        const array = get(current, path);
        if (!array || array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array ? array.meta.type : 'null'}`,
            );
        }
        const meta = array.meta;

        const relIdx = meta.idsInOrder.indexOf(relativeTo);
        if (relIdx === -1) {
            throw new Error(
                `Relative ${relativeTo} not in children ${meta.idsInOrder.join(', ')}}`,
            );
        }
        const [prev, after] = before
            ? [meta.idsInOrder[relIdx - 1], relativeTo]
            : [relativeTo, meta.idsInOrder[relIdx + 1]];
        const newSort = sortedArray.between(
            prev ? meta.items[prev].sort.idx : null,
            after ? meta.items[after].sort.idx : null,
        );

        const sort = {
            stamp,
            idx: newSort,
        };
        return {
            type: 'insert',
            path: makeKeyPath(current.meta, path.concat([id])),
            sort,
            value,
        };
    },
    reorderRelative<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        id: string,
        relativeTo: string,
        before: boolean,
        stamp: string,
    ): HostDelta<T, Other> {
        const array = get(current, path);
        if (!array || array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array ? array.meta.type : 'null'}`,
            );
        }
        const meta = array.meta;

        const idx = meta.idsInOrder.indexOf(id);

        const without = meta.idsInOrder.slice();
        const [_] = without.splice(idx, 1);

        const relIdx = without.indexOf(relativeTo);
        const [prev, after] = before
            ? [without[relIdx - 1], relativeTo]
            : [relativeTo, without[relIdx + 1]];
        const newSort = sortedArray.between(
            prev ? meta.items[prev].sort.idx : null,
            after ? meta.items[after].sort.idx : null,
        );

        const sort = {
            stamp,
            idx: newSort,
        };
        // console.log('sorting to', idx, relIdx, sort, prev, after);
        // console.log(meta.idsInOrder);
        // console.log(id, relativeTo);
        // ooh ok so idx can be -1? That's not great.
        return {
            type: 'reorder',
            path: makeKeyPath(current.meta, path.concat([id])),
            sort,
        };
    },
    reorder<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        idx: number,
        // newIdx is *after* the item has been removed.
        newIdx: number,
        stamp: string,
    ): HostDelta<T, Other> {
        const array = get(current, path);
        if (!array || array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array ? array.meta.type : 'null'}`,
            );
        }
        const meta = array.meta;
        const without = meta.idsInOrder.slice();
        const [id] = without.splice(idx, 1);
        const sort = {
            stamp,
            idx: sortedArray.sortForInsertion(without, id => meta.items[id].sort.idx, newIdx),
        };
        // console.log(without, )
        return {
            type: 'reorder',
            path: makeKeyPath(current.meta, path.concat([id])),
            sort,
        };
    },
    remove<T, Other>(hlcStamp: string): HostDelta<?T, Other> {
        return {
            type: 'set',
            path: [],
            value: { value: null, meta: { type: 't', hlcStamp } },
        };
    },
    removeAt<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        hlcStamp: string,
    ): HostDelta<?T, Other> {
        const value: CRDT<?T, Other> = {
            value: null,
            meta: { type: 't', hlcStamp },
        };
        const keyPath = makeKeyPath(current.meta, path);
        return {
            type: 'set',
            path: keyPath,
            value,
        };
    },
};
