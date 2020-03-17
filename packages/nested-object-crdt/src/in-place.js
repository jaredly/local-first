// @flow

export type MapMeta<Other> = {|
    type: 'map',
    map: { [key: string]: Meta<Other> },
    hlcStamp: string,
|};

export type OtherMeta<Other> = {|
    type: 'other',
    meta: Other,
|};
export type PlainMeta<Other> = {|
    type: 'plain',
    hlcStamp: string,
    mapValues?: { [key: string]: CRDT<any, Other> },
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
            const stamp = latestStamp(meta.map[id], otherStamp);
            if (stamp && (!max || stamp > max)) {
                max = stamp;
            }
        });
        return max;
    } else if (meta.type === 'plain') {
        let max = meta.hlcStamp;
        if (meta.mapValues) {
            const map = meta.mapValues;
            Object.keys(map).forEach(id => {
                const stamp = latestStamp(map[id].meta, otherStamp);
                if (stamp && (!max || stamp > max)) {
                    max = stamp;
                }
            });
        }
        return max;
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
