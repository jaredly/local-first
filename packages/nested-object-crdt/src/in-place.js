// @flow

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

export type PlainMeta<Other> = {|
    type: 'plain',
    hlcStamp: string,
|};

export type Meta<Other> = MapMeta<Other> | PlainMeta<Other> | OtherMeta<Other>;

export type CRDT<T, Other> = {|
    value: T,
    meta: MapMeta<Other>,
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
    } else {
        return otherStamp(meta.meta);
    }
};

export const latestStamp = function<T, Other>(
    data: CRDT<T, Other>,
    otherStamp: Other => ?string,
): string {
    const latest = latestMetaStamp(data.meta, otherStamp);
    return latest ?? '';
};

const deltas = {
    diff<T, Other>(one: ?CRDT<T, Other>, two: CRDT<T, Other>) {
        if (!one) {
            return deltas.set([], two);
        }
        // TODO something a little more intelligent probably?
        return deltas.set([], two);
    },
    stamp<T, Other>(
        delta: HostDelta<T, Other>,
        otherStamp: Other => ?string,
    ): string {
        return latestStamp(delta.value, otherStamp);
    },
    set<T, Other>(
        path: Array<string>,
        value: CRDT<T, Other>,
    ): HostDelta<T, Other> {
        return {
            type: 'set',
            path,
            value,
        };
    },
    remove: (hlcStamp: string) => ({
        type: 'set',
        path: [],
        value: create(null, hlcStamp),
    }),
    removeAt: (path: Array<string>, hlcStamp: string) => ({
        type: 'set',
        path,
        value: create(null, hlcStamp),
    }),
    apply<T, Other, OtherDelta>(
        data: ?CRDT<T, Other>,
        delta: Delta<T, Other, OtherDelta>,
    ) {
        return applyDelta(data ? data : createEmpty(), delta);
    },
};

export type HostDelta<T, Other> = {
    type: 'set',
    path: Array<string>,
    value: CRDT<T, Other>,
};

export type Delta<T, Other, OtherDelta> =
    | HostDelta<T, Other>
    | {
          type: 'other',
          path: Array<string>,
          delta: OtherDelta,
      };

const applyDelta = function<T, Other, OtherDelta>(
    crdt: CRDT<T, Other>,
    delta: Delta<T, Other, OtherDelta>,
    applyOtherDelta: (any, Other, OtherDelta) => Other,
): CRDT<T, Other> {
    switch (delta.type) {
        case 'set':
            if (delta.path.length === 0) {
                return merge(crdt, delta.value);
            }
            return set(crdt, delta.path, delta.value);
    }
    throw new Error('unknown delta type' + JSON.stringify(delta));
};

const value = function<T, Other>(crdt: CRDT<T, Other>): T {
    return crdt.value;
};

const remove = function<T, Other>(
    crdt: CRDT<T, Other>,
    ts: string,
): CRDT<T, Other> {
    return create(null, ts);
};

const removeAt = function<T, Other>(
    map: CRDT<T, Other>,
    key: Array<string>,
    hlcStamp: string,
): CRDT<T, Other> {
    return set(map, key, create(null, hlcStamp));
};

const setInner = () => {};

type KeyPath = Array<{ stamp: string, key: string }>;

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
    if (key[0].stamp > crdt.meta.hlcStamp) {
        throw new Error(
            `Invalid delta, cannot apply - ${crdt.meta.type} stamp (${crdt.meta.hlcStamp}) is older than key path stamp (${key[0].stamp})`,
        );
    }

    if (crdt.meta.type === 'map') {
        const k = key[0].key;
        // This delta is too old; the map was created more recently and so this change doesn't apply
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
        }
    } else if (crdt.meta.type === 'plain') {
        throw new Error(
            `Invalid delta - plain stamp ${crdt.meta.hlcStamp} is older than key path stamp (${key[0].stamp})`,
        );
    } else if (crdt.meta.type === 'other') {
    }
    throw new Error('aa');

    // if (crdt.meta.type === 'map') {
    //     const k = key[0];
    //     let v = crdt.map[k];
    //     if (key.length === 1) {
    //         const nv = merge(v, value);
    //         return {
    //             ...crdt,
    //             map: { ...crdt.map, [k]: nv },
    //             hlcStamp:
    //                 nv.hlcStamp < crdt.hlcStamp ? nv.hlcStamp : crdt.hlcStamp,
    //         };
    //     }
    //     if (!v) {
    //         // v = createEmpty();
    //         // maybe here I make a `null` plain & set the attrs accordingly?
    //         throw new Error('setting a key that doesnt yet exist');
    //     }
    //     const nv = set(v, key.slice(1), value);
    //     return {
    //         ...crdt,
    //         map: { ...crdt.map, [k]: nv },
    //         hlcStamp: nv.hlcStamp < crdt.hlcStamp ? nv.hlcStamp : crdt.hlcStamp,
    //     };
    // } else {
    //     if (value.type === 'plain') {
    //         if (value.hlcStamp > crdt.hlcStamp) {
    //             const mapValues = { ...crdt.mapValues };
    //             if (key.length === 1) {
    //                 mapValues[key[0]] = merge(mapValues[key[0]], value);
    //             } else {
    //                 mapValues[key[0]] = merge(
    //                     mapValues[key[0]],
    //                     set(
    //                         {
    //                             type: 'map',
    //                             map: {},
    //                             hlcStamp: MIN_STAMP,
    //                         },
    //                         key.slice(1),
    //                         value,
    //                     ),
    //                 );
    //             }
    //             return { ...crdt, mapValues };
    //         }
    //     } else {
    //         const map = prune(value.map, crdt.hlcStamp);
    //         if (map) {
    //             const mapValues = { ...crdt.mapValues };
    //             if (key.length === 1) {
    //                 mapValues[key[0]] = merge(mapValues[key[0]], {
    //                     ...value,
    //                     map,
    //                 });
    //             } else {
    //                 mapValues[key[0]] = merge(
    //                     mapValues[key[0]],
    //                     set(
    //                         {
    //                             type: 'map',
    //                             map: {},
    //                             hlcStamp: MIN_STAMP,
    //                         },
    //                         key.slice(1),
    //                         { ...value, map },
    //                     ),
    //                 );
    //             }
    //             return { ...crdt, mapValues };
    //         }
    //     }
    //     return crdt;
    // }
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
