// @flow

import * as sortedArray from './array-utils';
import deepEqual from 'fast-deep-equal';

export const MIN_STAMP = '';

export type KeyPath = Array<{ stamp: string, key: string }>;

export type Sort = Array<number>;

export type ArrayMeta<Other> = {|
    type: 'array',
    items: {
        [key: string]: {
            sort: { stamp: string, idx: Sort },
            meta: Meta<Other>,
        },
    },
    // This is just a cache
    idsInOrder: Array<string>,
    hlcStamp: string,
|};

export type MapMeta<Other> = {|
    type: 'map',
    map: { [key: string]: Meta<Other> },
    hlcStamp: string,
|};

export type OtherMeta<Other> = {|
    type: 'other',
    meta: Other,
    hlcStamp: string,
|};

export type PlainMeta = {|
    type: 'plain',
    hlcStamp: string,
|};

export type TombstoneMeta = {|
    type: 't',
    hlcStamp: string,
|};

export type HostDelta<T, Other> =
    | {|
          type: 'set',
          path: KeyPath,
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'insert',
          path: KeyPath,
          // The last ID is the ID to add here folks
          sort: { idx: Sort, stamp: string },
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'reorder',
          path: KeyPath,
          sort: { idx: Sort, stamp: string },
      |};

export type Delta<T, Other, OtherDelta> =
    | HostDelta<T, Other>
    | {
          type: 'other',
          path: KeyPath,
          delta: OtherDelta,
      };

export type Meta<Other> =
    | MapMeta<Other>
    | PlainMeta
    | TombstoneMeta
    | OtherMeta<Other>
    | ArrayMeta<Other>;

export type CRDT<T, Other> = {|
    value: T,
    meta: Meta<Other>,
|};

export type OtherMerge<Other> = (
    v1: any,
    m1: Other,
    v2: any,
    m2: Other,
) => { value: any, meta: Other };

export const checkConsistency = function<T, Other>(
    crdt: CRDT<T, Other>,
): ?Array<string> {
    if (crdt.meta.type === 'plain') {
        return null;
    }
    if (crdt.meta.type === 't') {
        if (crdt.value != null) {
            throw new Error('expected tombstone value to be null');
        }
        return;
    }
    if (crdt.meta.type === 'other') {
        return;
    }
    if (crdt.meta.type === 'map') {
        if (
            !crdt.value ||
            Array.isArray(crdt.value) ||
            typeof crdt.value !== 'object'
        ) {
            throw new Error(`Meta is map, but value doesn't match`);
        }
        for (let id in crdt.meta.map) {
            checkConsistency({
                value: crdt.value[id],
                meta: crdt.meta.map[id],
            });
        }
        return;
    }
    if (crdt.meta.type === 'array') {
        if (!crdt.value || !Array.isArray(crdt.value)) {
            throw new Error(`meta is 'array' but value doesn't match`);
        }
        const { value, meta } = crdt;
        const ids = Object.keys(meta.items)
            .filter(key => meta.items[key].meta.type !== 't')
            .sort((a, b) =>
                sortedArray.compare(
                    meta.items[a].sort.idx,
                    meta.items[b].sort.idx,
                ),
            );
        if (!deepEqual(ids, meta.idsInOrder)) {
            throw new Error(
                `idsInOrder mismatch! ${ids.join(
                    ',',
                )} vs cached ${meta.idsInOrder.join(',')}`,
            );
        }
        if (value.length !== ids.length) {
            throw new Error(
                `Value has a different length than non-tombstone IDs`,
            );
        }
        meta.idsInOrder.forEach((id, i) => {
            checkConsistency({
                value: value[i],
                meta: meta.items[id].meta,
            });
        });
    }
};

const latestMetaStamp = function<Other>(
    meta: Meta<Other>,
    otherStamp: Other => ?string,
): ?string {
    if (meta.type === 'map') {
        let max = meta.hlcStamp;
        Object.keys(meta.map).forEach(id => {
            const stamp = latestMetaStamp(meta.map[id], otherStamp);
            if (stamp && (!max || stamp > max)) {
                max = stamp;
            }
        });
        return max;
    } else if (meta.type === 'plain' || meta.type === 't') {
        return meta.hlcStamp;
    } else if (meta.type === 'array') {
        let max = meta.hlcStamp;
        Object.keys(meta.items).forEach(id => {
            const stamp = latestMetaStamp(meta.items[id].meta, otherStamp);
            if (stamp && (!max || stamp > max)) {
                max = stamp;
            }
        });
        return max;
    } else {
        const max = meta.hlcStamp;
        const inner = otherStamp(meta.meta);
        return inner && inner > max ? inner : max;
    }
};

export const latestStamp = function<T, Other>(
    data: CRDT<T, Other>,
    otherStamp: Other => ?string,
): string {
    const latest = latestMetaStamp(data.meta, otherStamp);
    return latest ?? '';
};

const makeKeyPath = function<T, Other>(
    current: Meta<Other>,
    path: Array<string | number>,
) {
    return path.map((item, i) => {
        if (!current) {
            throw new Error(
                `Invalid key path - doesn't represent the current state of things.`,
            );
        }
        const stamp = current.hlcStamp;
        if (current.type === 'array') {
            if (typeof item === 'number') {
                if (current.type !== 'array') {
                    throw new Error(
                        `Cannot get a number ${item} of a ${current.type}`,
                    );
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
            throw new Error(
                `Can't get a sub-item ${item} of a ${current.type}`,
            );
        }
    });
};

export const deltas = {
    diff<T, Other>(one: ?CRDT<T, Other>, two: CRDT<T, Other>) {
        if (!one) {
            // return deltas.set([], two);
            return { type: 'set', path: [], value };
        }
        // TODO something a little more intelligent probably?
        // return deltas.set([], two);
        return { type: 'set', path: [], value };
    },
    stamp<T, Other>(
        delta: HostDelta<T, Other>,
        otherStamp: Other => ?string,
    ): string {
        return delta.type === 'set'
            ? latestStamp(delta.value, otherStamp)
            : delta.sort.stamp;
    },
    replace<T, Other>(value: CRDT<T, Other>): HostDelta<T, Other> {
        return { type: 'set', value, path: [] };
    },
    set<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        value: CRDT<T, Other>,
    ): HostDelta<T, Other> {
        const keyPath = makeKeyPath(current.meta, path);
        return {
            type: 'set',
            path: keyPath,
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
        if (array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array.meta.type}`,
            );
        }
        const meta = array.meta;
        const sort = {
            stamp,
            idx: sortedArray.sortForInsertion(
                meta.idsInOrder,
                id => meta.items[id].sort.idx,
                idx,
            ),
        };
        return {
            type: 'insert',
            path: makeKeyPath(current.meta, path.concat([id])),
            sort,
            value,
        };
    },
    reorder<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        idx: number,
        newIdx: number,
        stamp: string,
    ): HostDelta<T, Other> {
        const array = get(current, path);
        if (array.meta.type !== 'array') {
            throw new Error(
                `Can only insert into an array, not a ${array.meta.type}`,
            );
        }
        const meta = array.meta;
        const without = meta.idsInOrder.slice();
        const [id] = without.splice(idx, 1);
        const sort = {
            stamp,
            idx: sortedArray.sortForInsertion(
                without,
                id => meta.items[id].sort.idx,
                idx,
            ),
        };
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
    apply<T, O, Other, OtherDelta>(
        data: ?CRDT<?T, Other>,
        delta: Delta<?O, Other, OtherDelta>,
        applyOtherDelta: (any, Other, OtherDelta) => Other,
        mergeOther: OtherMerge<Other>,
    ): CRDT<?T, Other> {
        return applyDelta(
            data ? data : createEmpty(),
            delta,
            applyOtherDelta,
            mergeOther,
        );
    },
};

export const applyDelta = function<T, O, Other, OtherDelta>(
    crdt: CRDT<T, Other>,
    delta: Delta<O, Other, OtherDelta>,
    applyOtherDelta: (any, Other, OtherDelta) => Other,
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    switch (delta.type) {
        case 'set':
            return set(crdt, delta.path, delta.value, mergeOther);
        case 'insert':
            return insert(crdt, delta.path, delta.sort, delta.value);
        case 'reorder':
            return reorder(crdt, delta.path, delta.sort);
    }
    throw new Error('unknown delta type' + JSON.stringify(delta));
};

export const value = function<T, Other>(crdt: CRDT<T, Other>): T {
    return crdt.value;
};

export const remove = function<T, Other>(
    crdt: CRDT<T, Other>,
    ts: string,
): CRDT<null, Other> {
    return { value: null, meta: { type: 't', hlcStamp: ts } };
};

export const removeAt = function<T, O, Other>(
    map: CRDT<?T, Other>,
    path: KeyPath,
    hlcStamp: string,
    mergeOther: OtherMerge<Other>,
): CRDT<?T, Other> {
    return set<?T, ?O, Other>(
        map,
        path,
        {
            value: null,
            meta: { type: 't', hlcStamp },
        },
        mergeOther,
    );
};

const insertIntoArray = function<T, Other>(
    array: $ReadOnlyArray<T>,
    meta: ArrayMeta<Other>,
    id: string,
    sort: { idx: Sort, stamp: string },
    value: CRDT<T, Other>,
): CRDT<Array<T>, Other> {
    if (value.meta.type === 't') {
        throw new Error(`Cannot insert a tombstone into an array`);
    }
    const newValue = array.slice();
    const idx = sortedArray.insertionIndex(
        meta.idsInOrder,
        id => meta.items[id].sort.idx,
        sort.idx,
    );
    newValue.splice(idx, 0, value.value);
    const items = {
        ...meta.items,
        [id]: { meta: value.meta, sort },
    };
    const ids = meta.idsInOrder.slice();
    ids.splice(idx, 0, id);
    const newMeta = {
        ...meta,
        items,
        idsInOrder: ids,
    };
    return { meta: newMeta, value: newValue };
};

const reorderArray = function<T, Other>(
    array: $ReadOnlyArray<T>,
    meta: ArrayMeta<Other>,
    id: string,
    sort: { idx: Sort, stamp: string },
): CRDT<$ReadOnlyArray<T>, Other> {
    const newValue = array.slice();
    const idx = meta.idsInOrder.indexOf(id);
    if (sort.stamp <= meta.items[id].sort.stamp) {
        return { value: array, meta };
    }
    const idsInOrder = meta.idsInOrder.slice();
    // if not there, it's a tombstoned item, don't need to modify stuff
    if (idx !== -1) {
        const [curValue] = newValue.splice(idx, 1);
        idsInOrder.splice(idx, 1);
        const newIdx = sortedArray.insertionIndex(
            idsInOrder,
            id => meta.items[id].sort.idx,
            sort.idx,
        );

        newValue.splice(newIdx, 0, curValue);
        idsInOrder.splice(newIdx, 0, id);
    }

    const items = {
        ...meta.items,
        [id]: { ...meta.items[id], sort },
    };
    const newMeta: ArrayMeta<Other> = {
        ...meta,
        items,
        idsInOrder,
    };
    return { meta: newMeta, value: newValue };
};

export const insert = function<T, O, Other>(
    crdt: CRDT<T, Other>,
    key: KeyPath,
    sort: { idx: Sort, stamp: string },
    value: CRDT<O, Other>,
): CRDT<T, Other> {
    return applyInner(crdt, key, (inner, id) => {
        if (!inner) {
            throw new Error(`No array at path`);
        }
        if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
            throw new Error(`Cannot insert into a ${inner.meta.type}`);
        }

        return insertIntoArray(inner.value, inner.meta, id, sort, value);
    });
};

export const reorder = function<T, Other>(
    crdt: CRDT<T, Other>,
    path: KeyPath,
    sort: { idx: Sort, stamp: string },
): CRDT<T, Other> {
    return applyInner(crdt, path, (inner, id) => {
        if (!inner) {
            throw new Error(`No array at path`);
        }
        if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
            console.log('a', JSON.stringify(inner), path);
            throw new Error(`Cannot insert ${id} into a ${inner.meta.type}`);
        }

        return reorderArray(inner.value, inner.meta, id, sort);
    });
};

export const set = function<T, O, Other>(
    crdt: CRDT<T, Other>,
    path: KeyPath,
    value: CRDT<O, Other>,
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    if (!path.length) {
        // $FlowFixMe
        return merge(
            crdt.value,
            crdt.meta,
            value.value,
            value.meta,
            mergeOther,
        );
    }
    return applyInner(crdt, path, (inner, key) => {
        if (!inner) {
            return value;
        }
        if (inner.meta.type === 'map') {
            if (
                !inner.value ||
                typeof inner.value !== 'object' ||
                Array.isArray(inner.value)
            ) {
                throw new Error(`Invalid value, doesn't match meta type 'map'`);
            }
            const res = inner.meta.map[key]
                ? merge(
                      inner.value[key],
                      inner.meta.map[key],
                      value.value,
                      value.meta,
                      mergeOther,
                  )
                : value;
            const newv = { ...inner.value };
            if (res.meta.type === 't') {
                delete newv[key];
            } else {
                newv[key] = res.value;
            }
            return {
                value: newv,
                meta: {
                    ...inner.meta,
                    map: {
                        ...inner.meta.map,
                        [key]: res.meta,
                    },
                },
            };
        } else if (inner.meta.type === 'array') {
            if (!Array.isArray(inner.value)) {
                throw new Error(`Not an array`);
            }
            const array = inner.value;
            const meta = inner.meta;
            const idx = meta.idsInOrder.indexOf(key);
            const merged = merge(
                // if it's not in there, we're dealing with a tombstone
                idx === -1 ? null : array[idx],
                meta.items[key].meta,
                value.value,
                value.meta,
                mergeOther,
            );
            const res = array.slice();
            let idsInOrder = meta.idsInOrder;
            if (merged.meta.type === 't' && meta.items[key].meta.type !== 't') {
                res.splice(idx, 1);
                idsInOrder = idsInOrder.slice();
                idsInOrder.splice(idx, 1);
            } else if (
                meta.items[key].meta.type === 't' &&
                merged.meta.type !== 't'
            ) {
                const idx = sortedArray.insertionIndex(
                    idsInOrder,
                    id => meta.items[id].sort.idx,
                    meta.items[key].sort.idx,
                );
                res.splice(idx, 0, merged.value);
                idsInOrder = idsInOrder.slice();
                idsInOrder.splice(idx, 0, key);
            } else {
                res[idx] = merged.value;
            }
            return {
                value: res,
                meta: {
                    ...meta,
                    idsInOrder,
                    items: {
                        ...meta.items,
                        [key]: {
                            meta: merged.meta,
                            sort: meta.items[key].sort,
                        },
                    },
                },
            };
        } else {
            throw new Error(`Cannot 'set' into a ${inner.meta.type}`);
        }
    });
};

export const get = function<T, O, Other>(
    crdt: CRDT<T, Other>,
    path: Array<string | number>,
) {
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

const applyInner = function<T, O, Other, R>(
    crdt: CRDT<T, Other>,
    key: KeyPath,
    fn: (CRDT<O, Other>, string) => CRDT<O, Other>,
): CRDT<T, Other> {
    if (!crdt) {
        throw new Error('No crdt ' + JSON.stringify(key));
    }
    // console.log('inner', crdt.meta.hlcStamp, key);
    if (crdt.meta.hlcStamp > key[0].stamp) {
        return crdt;
    }
    // This delta is too old; the map was created more recently and so this change doesn't apply
    if (crdt.meta.hlcStamp < key[0].stamp) {
        throw new Error(
            `Invalid delta, cannot apply - ${crdt.meta.type} stamp (${crdt.meta.hlcStamp}) is older than key path stamp (${key[0].stamp})`,
        );
    }
    if (key.length === 1) {
        // $FlowFixMe
        return fn(crdt, key[0].key);
    }
    if (crdt.meta.type === 'map') {
        const k = key[0].key;
        if (
            !crdt.value ||
            typeof crdt.value !== 'object' ||
            Array.isArray(crdt.value)
        ) {
            throw new Error(`Invalid CRDT! Meta is misaligned with the value`);
        }
        const v = crdt.value[k];
        const meta = crdt.meta.map[k];

        const res = applyInner({ meta, value: v }, key.slice(1), fn);
        return {
            value: {
                ...crdt.value,
                [k]: res.value,
            },
            meta: {
                ...crdt.meta,
                map: {
                    ...crdt.meta.map,
                    [k]: res.meta,
                },
            },
        };
    } else if (crdt.meta.type === 'array') {
        const k = key[0].key;
        const meta = crdt.meta.items[k].meta;
        const idx = crdt.meta.idsInOrder.indexOf(k);
        if (!crdt.value || !Array.isArray(crdt.value)) {
            throw new Error(`Invalid CRDT! Meta is misaligned with the value`);
        }
        const arr = crdt.value.slice();
        const v = arr[idx];

        const res = applyInner({ meta, value: v }, key.slice(1), fn);
        arr[idx] = res.value;
        return {
            value: arr,
            meta: {
                ...crdt.meta,
                items: {
                    ...crdt.meta.items,
                    [k]: { ...crdt.meta.items[k], meta: res.meta },
                },
            },
        };
    }
    throw new Error(`Cannot set inside of a ${crdt.meta.type}`);
};

export const mergeMaps = function<T: {}, Other>(
    v1: T,
    m1: MapMeta<Other>,
    v2: T,
    m2: MapMeta<Other>,
    mergeOther: OtherMerge<Other>,
): {
    value: T,
    meta: Meta<Other>,
} {
    const value = { ...v1 };
    const meta = { ...m1, map: { ...m1.map } };
    Object.keys(v2).forEach(k => {
        if (meta.map[k]) {
            const res = merge(
                value[k],
                meta.map[k],
                v2[k],
                m2.map[k],
                mergeOther,
            );
            value[k] = res.value;
            meta.map[k] = res.meta;
        } else {
            value[k] = v2[k];
            meta.map[k] = m2.map[k];
        }
    });
    return { value, meta };
};

export const mergeArrays = function<T, Other>(
    v1: Array<T>,
    m1: ArrayMeta<Other>,
    v2: Array<T>,
    m2: ArrayMeta<Other>,
    mergeOther: OtherMerge<Other>,
): {
    value: Array<T>,
    meta: Meta<Other>,
} {
    const fullMap = {};
    m1.idsInOrder.forEach((id, i) => {
        fullMap[id] = { value: v1[i], meta: m1.items[id] };
    });
    // STOPSHIP account for tombstones!!!
    m2.idsInOrder.forEach((id, i) => {
        if (fullMap[id]) {
            const res = merge(
                fullMap[id].value,
                fullMap[id].meta.meta,
                v2[i],
                m2.items[id].meta,
                mergeOther,
            );
            const sort =
                fullMap[id].meta.sort.stamp > m2.items[id].sort.stamp
                    ? fullMap[id].meta.sort
                    : m2.items[id].sort;
            fullMap[id] = { value: res.value, meta: { meta: res.meta, sort } };
        } else {
            fullMap[id] = { value: v2[i], meta: m2.items[id] };
        }
    });
    const allIds = Object.keys(fullMap);
    // console.log(
    //     allIds,
    //     v1,
    //     v2,
    //     m1.idsInOrder,
    //     m2.idsInOrder,
    //     m2.idsInOrder === m1.idsInOrder,
    // );
    allIds.sort((a, b) =>
        sortedArray.compare(fullMap[a].meta.sort.idx, fullMap[b].meta.sort.idx),
    );
    const items = {};
    allIds.forEach(id => {
        items[id] = fullMap[id].meta;
    });
    return {
        value: allIds.map(id => fullMap[id].value),
        meta: {
            ...m1,
            idsInOrder: allIds,
            items,
        },
    };
};

export const mergeTwo = function<A, Other>(
    one: CRDT<A, Other>,
    two: CRDT<A, Other>,
    mergeOther: OtherMerge<Other>,
) {
    return merge(one.value, one.meta, two.value, two.meta, mergeOther);
};

export const merge = function<A, B, Other>(
    v1: A,
    m1: Meta<Other>,
    v2: B,
    m2: Meta<Other>,
    mergeOther: OtherMerge<Other>,
): {
    value: A | B,
    meta: Meta<Other>,
} {
    if (m1.hlcStamp > m2.hlcStamp) {
        return { value: v1, meta: m1 };
    }
    if (m1.hlcStamp < m2.hlcStamp) {
        return { value: v2, meta: m2 };
    }
    if (m1.type !== m2.type) {
        if (m1.hlcStamp === m2.hlcStamp) {
            throw new Error(
                `Stamps are the same, but types are different ${m1.hlcStamp} : ${m1.type} vs ${m2.hlcStamp} : ${m2.type}`,
            );
        }
    }
    if (m1.type === 'map' && m2.type === 'map') {
        // $FlowFixMe
        const { value, meta } = mergeMaps(v1, m1, v2, m2);
        return { value, meta };
    }
    if (m1.type === 'array' && m2.type === 'array') {
        if (!Array.isArray(v1) || !Array.isArray(v2)) {
            throw new Error(`Meta type is array, but values are not`);
        }
        // $FlowFixMe
        const { value, meta } = mergeArrays(v1, m1, v2, m2, mergeOther);
        return { value, meta };
    }
    if (m1.type === 'plain' && m2.type === 'plain') {
        // TODO maybe inlude a debug assert that v1 and v2 are equal?
        return { value: v1, meta: m1 };
    }
    if (m1.type === 'other' && m2.type === 'other') {
        const { value, meta } = mergeOther(v1, m1.meta, v2, m2.meta);
        return { value, meta: { ...m1, meta } };
    }
    throw new Error(`Unexpected types ${m1.type} : ${m2.type}`);
};

export const createDeepMeta = function<T, Other>(
    value: T,
    hlcStamp: string,
): Meta<Other> {
    if (!value || typeof value !== 'object') {
        return { type: 'plain', hlcStamp };
    }
    if (Array.isArray(value)) {
        return createDeepArrayMeta(value, hlcStamp);
    }
    return createDeepMapMeta(value, hlcStamp);
};

export const createDeep = function<T, Other>(
    value: T,
    hlcStamp: string,
): CRDT<T, Other> {
    return { value, meta: createDeepMeta(value, hlcStamp) };
};

export const createDeepArrayMeta = function<T, Other>(
    value: Array<T>,
    hlcStamp: string,
): ArrayMeta<Other> {
    const meta = {
        type: 'array',
        idsInOrder: [],
        items: {},
        hlcStamp,
    };
    let last = null;
    value.forEach(item => {
        const id = Math.random()
            .toString(36)
            .slice(2);
        const innerMeta = createDeepMeta(item, hlcStamp);
        const sort = sortedArray.between(last, null);
        last = sort;
        meta.items[id] = {
            meta: innerMeta,
            sort: { idx: sort, stamp: hlcStamp },
        };
        meta.idsInOrder.push(id);
    });
    return meta;
};

export const createDeepMapMeta = function<T: {}, Other>(
    value: T,
    hlcStamp: string,
): MapMeta<Other> {
    const meta: MapMeta<Other> = {
        type: 'map',
        map: {},
        hlcStamp,
    };
    Object.keys(value).forEach(k => {
        meta.map[k] = createDeepMeta(value[k], hlcStamp);
    });
    return meta;
};

export const createDeepMap = function<T: {}, Other>(
    value: T,
    hlcStamp: string,
): CRDT<T, Other> {
    return { value, meta: createDeepMapMeta(value, hlcStamp) };
};

export const create = function<T, Other>(
    value: T,
    hlcStamp: string,
): {| value: T, meta: PlainMeta |} {
    return { value, meta: { type: 'plain', hlcStamp } };
};

export const createEmpty = function<T, Other>(): CRDT<?T, Other> {
    return { value: null, meta: { type: 't', hlcStamp: MIN_STAMP } };
};
