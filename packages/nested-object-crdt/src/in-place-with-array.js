// @flow

export const MIN_STAMP = '';

export type KeyPath = Array<{ stamp: string, key: string }>;

export type Sort = Array<number>;

export type ArrayMeta<Other> = {|
    type: 'array',
    items: { [key: string]: { sort: Sort, meta: Meta<Other> } },
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

const genericize = function<T, Other>(
    value: T,
    meta: MapMeta<Other> | PlainMeta | OtherMeta<Other> | ArrayMeta<Other>,
): CRDT<T, Other> {
    const gmeta: Meta<Other> = meta;
    return { value, meta: gmeta };
};

export type Meta<Other> =
    | MapMeta<Other>
    | PlainMeta
    | OtherMeta<Other>
    | ArrayMeta<Other>;

export type CRDT<T, Other> = {|
    value: T,
    meta: Meta<Other>,
|};

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
    } else if (meta.type === 'plain') {
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
    return path.map(item => {
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

const deltas = {
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
        return latestStamp(delta.value, otherStamp);
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
    remove: (hlcStamp: string) => ({
        type: 'set',
        path: [],
        value: create(null, hlcStamp),
    }),
    removeAt<T, Other>(
        current: CRDT<T, Other>,
        path: Array<string | number>,
        hlcStamp: string,
    ) {
        return {
            type: 'set',
            path: makeKeyPath(current.meta, path),
            value: create(null, hlcStamp),
        };
    },
    apply<T, Other, OtherDelta>(
        data: ?CRDT<?T, Other>,
        delta: Delta<?T, Other, OtherDelta>,
        applyOtherDelta: (any, Other, OtherDelta) => Other,
        mergeOther: OtherMerge<Other>,
    ) {
        return applyDelta(
            data ? data : createEmpty(),
            delta,
            applyOtherDelta,
            mergeOther,
        );
    },
};

export type HostDelta<T, Other> = {
    type: 'set',
    path: KeyPath,
    value: CRDT<T, Other>,
};

export type Delta<T, Other, OtherDelta> =
    | HostDelta<T, Other>
    | {
          type: 'other',
          path: KeyPath,
          delta: OtherDelta,
      };

const applyDelta = function<T, Other, OtherDelta>(
    crdt: CRDT<T, Other>,
    delta: Delta<T, Other, OtherDelta>,
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
                return genericize(value, meta);
            }
            return set(crdt, delta.path, delta.value, mergeOther);
    }
    throw new Error('unknown delta type' + JSON.stringify(delta));
};

const value = function<T, Other>(crdt: CRDT<T, Other>): T {
    return crdt.value;
};

const remove = function<T, Other>(
    crdt: CRDT<T, Other>,
    ts: string,
): CRDT<null, Other> {
    const { value, meta } = create(null, ts);
    return genericize(value, meta);
};

const removeAt = function<T, Other>(
    map: CRDT<?T, Other>,
    key: KeyPath,
    hlcStamp: string,
    mergeOther: OtherMerge<Other>,
): CRDT<?T, Other> {
    const { value, meta } = create(null, hlcStamp);
    return set(map, key, genericize(value, meta), mergeOther);
};

const set = function<T, Other>(
    crdt: CRDT<T, Other>,
    key: KeyPath,
    value: CRDT<T, Other>,
    mergeOther: OtherMerge<Other>,
): CRDT<T, Other> {
    if (key.length === 0) {
        if (value.meta.hlcStamp === crdt.meta.hlcStamp) {
            const result = merge(
                value.value,
                value.meta,
                crdt.value,
                crdt.meta,
                mergeOther,
            );
            // $FlowFixMe
            return { value: result.value, meta: result.meta };
        }
        return value.meta.hlcStamp > crdt.meta.hlcStamp ? value : crdt;
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

        if (key.length === 1) {
            const res = merge(v, meta, value.value, value.meta, mergeOther);
            return {
                value: {
                    ...crdt.value,
                    [k]: res.value,
                },
                meta: {
                    ...crdt.meta,
                    [k]: res.meta,
                },
            };
        } else {
            const res = set(
                { meta, value: v },
                key.slice(1),
                value,
                mergeOther,
            );
            return {
                value: {
                    ...crdt.value,
                    [k]: res.value,
                },
                meta: {
                    ...crdt.meta,
                    [k]: res.meta,
                },
            };
        }
    } else if (crdt.meta.type === 'array') {
        const k = key[0].key;
        const meta = crdt.meta.items[k].meta;
        const idx = crdt.meta.idsInOrder.indexOf(k);
        if (!crdt.value || !Array.isArray(crdt.value)) {
            throw new Error(`Invalid CRDT! Meta is misaligned with the value`);
        }
        const arr = crdt.value.slice();
        const v = arr[idx];

        if (key.length === 1) {
            const res = merge(v, meta, value.value, value.meta, mergeOther);
            arr[idx] = res.value;
            return {
                value: arr,
                meta: {
                    ...crdt.meta,
                    [k]: res.meta,
                },
            };
        } else {
            const res = set(
                { meta, value: v },
                key.slice(1),
                value,
                mergeOther,
            );
            arr[idx] = res.value;
            return {
                value: arr,
                meta: {
                    ...crdt.meta,
                    [k]: res.meta,
                },
            };
        }
    } else if (crdt.meta.type === 'plain') {
        throw new Error(`Invalid delta - cannot set inside of a plain value`);
    } else if (crdt.meta.type === 'other') {
        throw new Error(`Invalid delta - cannot set inside of an 'other'`);
    }
    throw new Error(`Unexpected meta type ${crdt.meta.type}`);
};

type OtherMerge<Other> = (
    v1: any,
    m1: Other,
    v2: any,
    m2: Other,
) => { value: any, meta: Other };

const mergeMaps = function<T: {}, Other>(
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

const merge = function<A, B, Other>(
    v1: A,
    m1: Meta<Other>,
    v2: B,
    m2: Meta<Other>,
    mergeOther: OtherMerge<Other>,
): {
    value: A | B,
    meta: Meta<Other>,
} {
    if (!v2) {
        return { value: v1, meta: m1 };
    }
    if (m1.type !== m2.type) {
        if (m1.hlcStamp === m2.hlcStamp) {
            throw new Error(
                `Stamps are the same, but types are different ${m1.hlcStamp} : ${m1.type} vs ${m2.hlcStamp} : ${m2.type}`,
            );
        }
        return m1.hlcStamp > m2.hlcStamp
            ? { value: v1, meta: m1 }
            : { value: m2, meta: m2 };
    }
    if (m1.type === 'map' && m2.type === 'map') {
        if (m1.hlcStamp !== m2.hlcStamp) {
            return m1.hlcStamp > m2.hlcStamp
                ? { value: v1, meta: m1 }
                : { value: v2, meta: m2 };
        }
        // $FlowFixMe
        const { value, meta } = mergeMaps(v1, m1, v2, m2); //
        // $FlowFixMe
        return { value, meta };
    }
    if (m1.type === 'plain' && m2.type === 'plain') {
        // TODO maybe inlude a debug assert that v1 and v2 are equal?
        return m1.hlcStamp > m2.hlcStamp
            ? { value: v1, meta: m1 }
            : { value: v2, meta: m2 };
    }
    if (m1.type === 'other' && m2.type === 'other') {
        if (m1.hlcStamp === m2.hlcStamp) {
            const { value, meta } = mergeOther(v1, m1.meta, v2, m2.meta);
            return { value, meta: { ...m1, meta } };
        }
        return m1.hlcStamp > m2.hlcStamp
            ? { value: v1, meta: m1 }
            : { value: v2, meta: m2 };
    }
    throw new Error(`Unexpected types ${m1.type} : ${m2.type}`);
};

const createDeepMap = function<T: {}, Other>(
    value: T,
    hlcStamp: string,
): {|
    value: T,
    meta: MapMeta<Other>,
|} {
    const meta: MapMeta<Other> = {
        type: 'map',
        map: {},
        hlcStamp,
    };
    Object.keys(value).forEach(k => {
        if (value[k] && typeof value[k] === 'object') {
            meta[k] = createDeepMap(value[k], hlcStamp);
        } else {
            meta[k] = create(value[k], hlcStamp);
        }
    });
    return { value, meta };
};

const createValue = function<T, Other>(
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

const createMap = function<T: {}, Other>(
    value: T,
    hlcStamp,
): {| value: T, meta: MapMeta<Other> |} {
    const meta = { type: 'map', map: {}, hlcStamp };
    Object.keys(value).forEach(k => {
        meta[k] = create(value[k], hlcStamp);
    });
    return { value, meta };
};

const create = function<T, Other>(
    value: T,
    hlcStamp: string,
): {| value: T, meta: PlainMeta |} {
    return { value, meta: { type: 'plain', hlcStamp } };
};

const createEmpty = function<T, Other>(): CRDT<?T, Other> {
    const { value, meta } = create(null, MIN_STAMP);
    return genericize(value, meta);
};
