// @flow

import * as sortedArray from './array-utils';
import type {
    CRDT,
    Meta,
    Sort,
    KeyPath,
    Delta,
    HostDelta,
    ArrayMeta,
    PlainMeta,
    MapMeta,
    OtherMerge,
} from './types';
import { get } from './deltas';

export const applyDelta = function<T, O, Other, OtherDelta>(
    crdt: ?CRDT<T, Other>,
    delta: Delta<O, Other, OtherDelta>,
    applyOtherDelta: <T, Other>(T, Other, OtherDelta) => { value: T, meta: Other },
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    if (!crdt) {
        if (delta.type !== 'set' || delta.path.length) {
            throw new Error(`Only a 'replace' delta can be applied to an empty base`);
        }
        // $FlowFixMe
        return delta.value;
    }
    switch (delta.type) {
        case 'set':
            return set(crdt, delta.path, delta.value, mergeOther);
        case 'insert':
            return insert(crdt, delta.path, delta.sort, delta.value, mergeOther);
        case 'reorder':
            return reorder(crdt, delta.path, delta.sort);
        case 'other':
            return otherDelta(crdt, delta.path, delta.delta, applyOtherDelta);
    }
    throw new Error('unknown delta type' + JSON.stringify(delta));
};

export const remove = function<T, Other>(crdt: CRDT<T, Other>, ts: string): CRDT<null, Other> {
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
    mergeOther: OtherMerge<Other>,
): CRDT<$ReadOnlyArray<T>, Other> {
    if (value.meta.type === 't') {
        throw new Error(`Cannot insert a tombstone into an array`);
    }
    if (meta.items[id] != null && meta.items[id].meta.type !== 't') {
        const prev = meta.items[id];
        const merged = merge(
            // $FlowFixMe
            prev.meta.type !== 't' ? array[meta.idsInOrder.indexOf(id)] : null,
            prev.meta,
            value.value,
            value.meta,
            mergeOther,
        );

        // ok change the value
        const idx = meta.idsInOrder.indexOf(id);
        const newValue = array.slice();
        newValue[idx] = merged.value;

        const mergedSort = prev.sort.stamp > sort.stamp ? prev.sort : sort;
        const cmp = sortedArray.compare(prev.sort.idx, sort.idx);
        if (cmp === 0) {
            return {
                meta: {
                    ...meta,
                    items: {
                        ...meta.items,
                        [id]: { meta: merged.meta, sort: mergedSort },
                    },
                },
                value: newValue,
            };
        }

        // but what if we change the position?
        newValue.splice(idx, 1);
        const idsInOrder = meta.idsInOrder.slice();
        idsInOrder.splice(idx, 1);

        const newIdx = sortedArray.insertionIndex(
            idsInOrder,
            id => meta.items[id].sort.idx,
            mergedSort.idx,
            id,
        );

        const ids = meta.idsInOrder.slice();
        newValue.splice(newIdx, 0, value.value);
        ids.splice(newIdx, 0, id);
        const newMeta = {
            ...meta,
            items: {
                ...meta.items,
                [id]: { meta: value.meta, sort },
            },
            idsInOrder: ids,
        };
        return { meta: newMeta, value: newValue };
    }

    const newValue = array.slice();
    const idx = sortedArray.insertionIndex(
        meta.idsInOrder,
        id => meta.items[id].sort.idx,
        sort.idx,
        id,
    );
    const ids = meta.idsInOrder.slice();
    newValue.splice(idx, 0, value.value);
    ids.splice(idx, 0, id);
    const newMeta = {
        ...meta,
        items: {
            ...meta.items,
            [id]: { meta: value.meta, sort },
        },
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
            id,
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
    otherMerge: OtherMerge<Other>,
): CRDT<T, Other> {
    return applyInner(crdt, key, (inner, id) => {
        if (!inner) {
            throw new Error(`No array at path`);
        }
        if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
            console.log(inner);
            throw new Error(`Cannot insert into a ${inner.meta.type}`);
        }

        return insertIntoArray(inner.value, inner.meta, id, sort, value, otherMerge);
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
            throw new Error(`Cannot insert ${id} into a ${inner.meta.type}`);
        }

        return reorderArray(inner.value, inner.meta, id, sort);
    });
};

export const otherDelta = function<T, Other, OtherDelta>(
    crdt: CRDT<T, Other>,
    path: KeyPath,
    delta: OtherDelta,
    applyOtherDelta: <T, Other>(T, Other, OtherDelta) => { value: T, meta: Other },
): CRDT<T, Other> {
    return applyInner(crdt, path, (inner, id) => {
        if (inner.meta.type === 'map') {
            const { meta, value } = inner;
            if (meta.map[id].type !== 'other') {
                throw new Error(`Expected 'other', found ${meta.map[id].type}`);
            }
            const merged = applyOtherDelta(
                // $FlowFixMe
                inner.value[id],
                meta.map[id].meta,
                delta,
            );
            return {
                value: { ...value, [id]: merged.value },
                meta: {
                    ...meta,
                    map: {
                        ...meta.map,
                        [id]: { ...meta.map[id], meta: merged.meta },
                    },
                },
            };
        } else if (inner.meta.type === 'array') {
            const meta = inner.meta;
            const idx = meta.idsInOrder.indexOf(id);
            const merged = applyOtherDelta(
                inner.value[idx],
                // $FlowFixMe
                meta.items[id].meta,
                delta,
            );
            const value = inner.value.slice();
            value[idx] = merged.value;
            return {
                value,
                meta: {
                    ...meta,
                    items: {
                        ...meta.items,
                        [id]: { ...meta.items[id], meta: merged.meta },
                    },
                },
            };
        }
        // const value = get(inner, [id]);

        throw new Error(`Cannot set inside of a ${inner.meta.type}`);
    });
};

const mapSet = function<T: {}, O, Other>(
    inner: T,
    meta: MapMeta<Other>,
    key: string,
    value: CRDT<O, Other>,
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    const res = meta.map[key]
        ? merge(inner[key], meta.map[key], value.value, value.meta, mergeOther)
        : value;
    const newv = { ...inner };
    if (res.meta.type === 't') {
        delete newv[key];
    } else {
        newv[key] = res.value;
    }
    return {
        value: newv,
        meta: {
            ...meta,
            map: {
                ...meta.map,
                [key]: res.meta,
            },
        },
    };
};

const arraySet = function<T, Other>(
    array: Array<?T>,
    meta: ArrayMeta<Other>,
    key: string,
    value: CRDT<?T, Other>,
    mergeOther: OtherMerge<Other>,
): CRDT<Array<?T>, Other> {
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
        // console.log('removing', merged);
        res.splice(idx, 1);
        idsInOrder = idsInOrder.slice();
        idsInOrder.splice(idx, 1);
    } else if (meta.items[key].meta.type === 't' && merged.meta.type !== 't') {
        console.log('adding back in');
        const idx = sortedArray.insertionIndex(
            idsInOrder,
            id => meta.items[id].sort.idx,
            meta.items[key].sort.idx,
            key,
        );
        res.splice(idx, 0, merged.value);
        idsInOrder = idsInOrder.slice();
        idsInOrder.splice(idx, 0, key);
    } else {
        console.log('updating');
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
            // $FlowFixMe
            value.value,
            value.meta,
            mergeOther,
        );
    }
    return applyInner(crdt, path, (inner, key) => {
        if (!inner) {
            // $FlowFixMe
            return value;
        }
        if (inner.meta.type === 'map') {
            if (!inner.value || typeof inner.value !== 'object' || Array.isArray(inner.value)) {
                throw new Error(`Invalid value, doesn't match meta type 'map'`);
            }
            return mapSet(inner.value, inner.meta, key, value, mergeOther);
        } else if (inner.meta.type === 'array') {
            if (!Array.isArray(inner.value)) {
                throw new Error(`Not an array`);
            }
            // $FlowFixMe
            return arraySet(inner.value, inner.meta, key, value, mergeOther);
        } else {
            throw new Error(`Cannot 'set' into a ${inner.meta.type}`);
        }
    });
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
        const cmeta = crdt.meta;
        const k = key[0].key;
        if (crdt.value == null || typeof crdt.value !== 'object' || Array.isArray(crdt.value)) {
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
                ...cmeta,
                map: {
                    ...cmeta.map,
                    [k]: res.meta,
                },
            },
        };
    } else if (crdt.meta.type === 'array') {
        const cmeta = crdt.meta;
        const k = key[0].key;
        const meta = crdt.meta.items[k].meta;
        const idx = crdt.meta.idsInOrder.indexOf(k);
        if (crdt.value == null || !Array.isArray(crdt.value)) {
            throw new Error(`Invalid CRDT! Meta is misaligned with the value`);
        }
        const arr = crdt.value.slice();
        const v = arr[idx];

        const res = applyInner({ meta, value: v }, key.slice(1), fn);
        arr[idx] = res.value;
        return {
            value: arr,
            meta: {
                ...cmeta,
                items: {
                    ...cmeta.items,
                    [k]: { ...cmeta.items[k], meta: res.meta },
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
            const res = merge(value[k], meta.map[k], v2[k], m2.map[k], mergeOther);
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
    allIds.sort((a, b) => sortedArray.compare(fullMap[a].meta.sort.idx, fullMap[b].meta.sort.idx));
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
): CRDT<A, Other> {
    return (merge<A, A, Other>(one.value, one.meta, two.value, two.meta, mergeOther): any);
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
        const { value, meta } = mergeMaps(v1, m1, v2, m2, mergeOther);
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
    if (m1.type === 't' && m2.type === 't') {
        return { value: v1, meta: m1 };
    }
    throw new Error(`Unexpected types ${m1.type} : ${m2.type}`);
};
