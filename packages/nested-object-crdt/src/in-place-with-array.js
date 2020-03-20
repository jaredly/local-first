// @flow

import * as sortedArray from './sorted-array';
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
          type: 'replace',
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'set',
          path: KeyPath,
          key: string,
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'insert',
          path: KeyPath,
          idx: number,
          value: CRDT<T, Other>,
          stamp: string,
      |}
    | {|
          type: 'reorder',
          path: KeyPath,
          idx: number,
          newIdx: number,
          stamp: string,
      |};

export type Delta<T, Other, OtherDelta> =
    | HostDelta<T, Other>
    | {
          type: 'other',
          path: KeyPath,
          delta: OtherDelta,
      };

const genericize = function<T, Other>(
    value: T,
    meta: Meta<Other>,
): CRDT<T, Other> {
    const gmeta: Meta<Other> = meta;
    return { value, meta: gmeta };
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
        const ids = Object.keys(crdt.meta.items)
            .filter(key => crdt.meta.items[key].meta.type !== 't')
            .sort((a, b) =>
                sortedArray.compare(
                    crdt.meta.items[a].sort.idx,
                    crdt.meta.items[b].sort.idx,
                ),
            );
        if (!deepEqual(ids, crdt.meta.idsInOrder)) {
            throw new Error(
                `idsInOrder mismatch! ${ids.join(
                    ',',
                )} vs cached ${crdt.meta.idsInOrder.join(',')}`,
            );
        }
        if (crdt.value.length !== ids.length) {
            throw new Error(
                `Value has a different length than non-tombstone IDs`,
            );
        }
        crdt.meta.idsInOrder.forEach((id, i) => {
            checkConsistency({
                value: crdt.value[i],
                meta: crdt.meta.items[id].meta,
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
            if (i === path.length - 1 && typeof item === 'string') {
                return { key: item, stamp: '' };
            }
            throw new Error(
                `Invalid key path - doesn't represent the current state of things.`,
            );
        }
        const stamp = current.hlcStamp;
        if (typeof item === 'number') {
            if (current.type !== 'array') {
                throw new Error(
                    `Cannot get a number ${item} of a ${current.type}`,
                );
            }
            const key = current.idsInOrder[item];
            current = current.items[key].meta;
            return { stamp, key };
        } else {
            if (current.type !== 'map') {
                throw new Error(
                    `Cannot get a sub-item ${item} of a ${current.type}`,
                );
            }
            current = current.map[item];
            return { stamp, key: item };
        }
    });
};

export const deltas = {
    diff<T, Other>(one: ?CRDT<T, Other>, two: CRDT<T, Other>) {
        if (!one) {
            // return deltas.set([], two);
            return {
                type: 'set',
                path: [],
                value,
            };
        }
        // TODO something a little more intelligent probably?
        // return deltas.set([], two);
        return {
            type: 'set',
            path: [],
            value,
        };
    },
    stamp<T, Other>(
        delta: HostDelta<T, Other>,
        otherStamp: Other => ?string,
    ): string {
        return delta.type === 'set' || delta.type === 'replace'
            ? latestStamp(delta.value, otherStamp)
            : delta.stamp;
    },
    replace<T, Other>(value: CRDT<T, Other>): HostDelta<T, Other> {
        return { type: 'replace', value };
    },
    set<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        value: CRDT<T, Other>,
    ): HostDelta<T, Other> {
        if (path.length === 0) {
            return { type: 'replace', value };
        }
        const keyPath = makeKeyPath(current.meta, path);
        const last = keyPath.pop();
        // The last item -- if it's ... been set before me, then ... hm yeah I think the last 'stamp' is just the stamp of the last item, right? Yeah.
        return {
            type: 'set',
            path: keyPath,
            key: last.key,
            value,
        };
    },
    insert<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        idx: number,
        value: CRDT<T, Other>,
        stamp: string,
    ): HostDelta<T, Other> {
        return {
            type: 'insert',
            path: makeKeyPath(current.meta, path),
            idx,
            value,
            stamp,
        };
    },
    reorder<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        idx: number,
        newIdx: number,
        stamp: string,
    ): HostDelta<T, Other> {
        return {
            type: 'reorder',
            path: makeKeyPath(current.meta, path),
            idx,
            newIdx,
            stamp,
        };
    },
    remove<T, Other>(hlcStamp: string): HostDelta<?T, Other> {
        return {
            type: 'replace',
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
        if (path.length === 0) {
            return { type: 'replace', value };
        }
        const keyPath = makeKeyPath(current.meta, path);
        const last = keyPath.pop();
        return {
            type: 'set',
            path: keyPath,
            key: last.key,
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
            if (delta.path.length === 0) {
                const { value, meta } = merge(
                    crdt.value,
                    crdt.meta,
                    delta.value.value,
                    delta.value.meta,
                    mergeOther,
                );
                // $FlowFixMe
                return genericize(value, meta);
            }
            return set(crdt, delta.path, delta.key, delta.value, mergeOther);
        case 'insert':
            return insert(
                crdt,
                delta.path,
                delta.idx,
                delta.value,
                delta.stamp,
            );
        case 'reorder':
            return reorder(
                crdt,
                delta.path,
                delta.idx,
                delta.newIdx,
                delta.stamp,
            );
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
    const { value, meta } = create(null, ts);
    return genericize(value, meta);
};

export const removeAt = function<T, O, Other>(
    map: CRDT<?T, Other>,
    path: KeyPath,
    key: string,
    hlcStamp: string,
    mergeOther: OtherMerge<Other>,
): CRDT<?T, Other> {
    return set<?T, ?O, Other>(
        map,
        path,
        key,
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
    idx: number,
    value: CRDT<T, Other>,
    stamp: string,
): CRDT<Array<T>, Other> {
    if (value.meta.type === 't') {
        throw new Error(`Cannot insert a tombstone into an array`);
    }
    const newValue = array.slice();
    newValue.splice(idx, 0, value.value);
    const pre =
        idx === 0 ? null : meta.items[meta.idsInOrder[idx - 1]].sort.idx;
    const post =
        idx >= meta.idsInOrder.length
            ? null
            : meta.items[meta.idsInOrder[idx]].sort.idx;
    const id = Math.random()
        .toString(36)
        .slice(2); // STOPSHIP create a new ID
    const sort = sortedArray.between(pre, post);
    const items = {
        ...meta.items,
        [id]: { meta: value.meta, sort: { idx: sort, stamp } },
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
    idx: number,
    newIdx: number, // this is a post-removal idx btw
    stamp: string,
): CRDT<Array<T>, Other> {
    if (
        idx === newIdx ||
        meta.items[meta.idsInOrder[idx]].sort.stamp >= stamp
    ) {
        // $FlowFixMe
        return { value: array, meta };
    }
    const newValue = array.slice();
    const [curValue] = newValue.splice(idx, 1);
    newValue.splice(newIdx, 0, curValue);
    const idsInOrder = meta.idsInOrder.slice();
    const [id] = idsInOrder.splice(idx, 1);

    const pre =
        newIdx === 0 ? null : meta.items[idsInOrder[newIdx - 1]].sort.idx;
    const post =
        newIdx >= idsInOrder.length
            ? null
            : meta.items[idsInOrder[newIdx]].sort.idx;

    idsInOrder.splice(newIdx, 0, id);

    const sort = sortedArray.between(pre, post);
    const items = {
        ...meta.items,
        [id]: { ...meta.items[id], sort: { idx: sort, stamp } },
    };
    const newMeta = {
        ...meta,
        items,
        idsInOrder,
    };
    return { meta: newMeta, value: newValue };
};

export const insert = function<T, O, Other>(
    crdt: CRDT<T, Other>,
    key: KeyPath,
    idx: number,
    value: CRDT<O, Other>,
    stamp: string,
): CRDT<T, Other> {
    return applyInner(crdt, key, inner => {
        if (!inner) {
            throw new Error(`No array at path`);
        }
        if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
            throw new Error(`Cannot insert into a ${inner.meta.type}`);
        }

        return insertIntoArray(inner.value, inner.meta, idx, value, stamp);
    });
};

export const reorder = function<T, Other>(
    crdt: CRDT<T, Other>,
    path: KeyPath,
    idx: number,
    newIdx: number,
    stamp: string,
): CRDT<T, Other> {
    return applyInner(crdt, path, inner => {
        if (!inner) {
            throw new Error(`No array at path`);
        }
        if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
            throw new Error(`Cannot insert into a ${inner.meta.type}`);
        }

        return reorderArray(inner.value, inner.meta, idx, newIdx, stamp);
    });
};

export const set = function<T, O, Other>(
    crdt: CRDT<T, Other>,
    path: KeyPath,
    key: string,
    value: CRDT<O, Other>,
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    return applyInner(crdt, path, inner => {
        if (!inner) {
            return value;
        }
        if (!inner.meta) {
            console.log(inner);
        }
        if (inner.meta.type === 'map') {
            if (
                !inner.value ||
                typeof inner !== 'object' ||
                Array.isArray(inner)
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
            const meta = inner.meta;
            const idx = meta.idsInOrder.indexOf(key);
            const merged = merge(
                // if it's not in there, we're dealing with a tombstone
                idx === -1 ? null : inner.value[idx],
                meta.items[key].meta,
                value.value,
                value.meta,
                mergeOther,
            );
            const res = inner.value.slice();
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
            console.log('OK', merged, inner, value);
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

const applyInner = function<T, O, Other, R>(
    crdt: CRDT<T, Other>,
    key: KeyPath,
    fn: (CRDT<O, Other>) => CRDT<O, Other>,
): CRDT<T, Other> {
    if (key.length === 0) {
        // $FlowFixMe
        return fn(crdt);
    }
    if (!crdt) {
        throw new Error('No crdt ' + JSON.stringify(key));
    }
    if (crdt.meta.hlcStamp > key[0].stamp) {
        return crdt;
    }
    // This delta is too old; the map was created more recently and so this change doesn't apply
    if (crdt.meta.hlcStamp < key[0].stamp) {
        throw new Error(
            `Invalid delta, cannot apply - ${crdt.meta.type} stamp (${crdt.meta.hlcStamp}) is older than key path stamp (${key[0].stamp})`,
        );
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
    } else if (crdt.meta.type === 'plain') {
        throw new Error(`Invalid delta - cannot set inside of a plain value`);
    } else if (crdt.meta.type === 'other') {
        throw new Error(`Invalid delta - cannot set inside of an 'other'`);
    }
    throw new Error(`Unexpected meta type ${crdt.meta.type}`);
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
        const res = merge(value[k], meta.map[k], v2[k], m2.map[k], mergeOther);
        value[k] = res.value;
        meta.map[k] = res.meta;
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
    // const value =
    const fullMap = {};
    m1.idsInOrder.forEach((id, i) => {
        fullMap[id] = { value: v1[i], meta: m1.items[id] };
    });
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
        const { value, meta } = mergeArrays(v1, m2, v2, m2, mergeOther);
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

export const createValue = function<T, Other>(
    value: T,
    hlcStamp: string,
): CRDT<T, Other> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const res = createDeepMap(value, hlcStamp);
        return genericize(res.value, res.meta);
    } else {
        const res = create(value, hlcStamp);
        return genericize(res.value, res.meta);
    }
};

export const createMap = function<T: {}, Other>(
    value: T,
    hlcStamp: string,
): {| value: T, meta: MapMeta<Other> |} {
    const meta = { type: 'map', map: {}, hlcStamp };
    Object.keys(value).forEach(k => {
        meta.map[k] = { type: 'plain', hlcStamp };
    });
    return { value, meta };
};

export const create = function<T, Other>(
    value: T,
    hlcStamp: string,
): {| value: T, meta: PlainMeta |} {
    return { value, meta: { type: 'plain', hlcStamp } };
};

export const createEmpty = function<T, Other>(): CRDT<?T, Other> {
    const { value, meta } = create(null, MIN_STAMP);
    return genericize(value, meta);
};
