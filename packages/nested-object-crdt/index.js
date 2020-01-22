// @flow

export type MapCRDT = {|
    type: 'map',
    map: { [key: string]: CRDT },
    hlcStamp: string,
|};
export type PlainCRDT = {|
    type: 'plain',
    value: string | number | any,
    hlcStamp: string,
    mapValues?: { [key: string]: CRDT },
|};

// POTENTIAL UNEXPECTED BEHAVIOR
// - a client is using a new schema w/ new attributes
// - they set a map
// - they "remove" the map
// - you then set a map without the new attributes
// - on merge, their earlier removal will win, because the merged map's stamp will be based on the added attribute that you don't have.

// This is used as a filler for when we need to create a
// "container" map that should never live on its own.
const MIN_STAMP = '';

export type CRDT = MapCRDT | PlainCRDT;

export type Delta = {
    type: 'set',
    path: Array<string>,
    value: CRDT,
    hlcStamp: string,
};

const showDelta = (delta: Delta) => {
    switch (delta.type) {
        case 'set':
            return `<set> [${delta.path.join(':')}] ${show(delta.value)}`;
    }
};

const deltas = {
    set: (path: Array<string>, value: CRDT) => ({ type: 'set', path, value }),
    removeAt: (path: Array<string>, hlcStamp: string) => ({
        type: 'set',
        path,
        value: create(null, hlcStamp),
    }),
};

const applyDelta = (crdt: CRDT, delta: Delta): CRDT => {
    switch (delta.type) {
        case 'set':
            return set(crdt, delta.path, delta.value);
    }
    throw new Error('unknown delta type' + JSON.stringify(delta));
};

const showMap = map => {
    const res = [];
    Object.keys(map).forEach(k => {
        res.push(`${k}: ${show(map[k])}`);
    });
    return res;
};

const show = (crdt: CRDT) => {
    if (crdt.type === 'plain') {
        return (
            crdt.hlcStamp +
            '-' +
            JSON.stringify(crdt.value) +
            (crdt.mapValues ? `{{${showMap(crdt.mapValues).join(',')}}}` : '')
        );
    } else {
        return `${crdt.hlcStamp}-{${showMap(crdt.map).join(', ')}}`;
    }
};

const value = (crdt: CRDT) => {
    if (crdt.type === 'plain') {
        return crdt.value;
    } else {
        const map = {};
        Object.keys(crdt.map)
            .sort()
            .forEach(k => {
                map[k] = value(crdt.map[k]);
            });
        return map;
    }
};

const remove = (crdt: CRDT, ts: string): CRDT => {
    return create(null, ts);
};

const removeAt = (map: CRDT, key: Array<string>, hlcStamp: string): CRDT => {
    return set(map, key, create(null, hlcStamp));
};

const maybeMerge = (v: CRDT, o: ?CRDT): CRDT => {
    return o ? merge(v, o) : v;
};

const set = (crdt: CRDT, key: Array<string>, value: CRDT): CRDT => {
    if (crdt.type === 'map') {
        const k = key[0];
        const v = crdt.map[k];
        if (key.length === 1) {
            const nv = maybeMerge(value, v);
            return {
                ...crdt,
                map: { ...crdt.map, [k]: nv },
                hlcStamp:
                    nv.hlcStamp < crdt.hlcStamp ? nv.hlcStamp : crdt.hlcStamp,
            };
        }
        if (!v) {
            // maybe here I make a `null` plain & set the attrs accordingly?
            throw new Error('setting a key that doesnt yet exist');
        }
        const nv = set(v, key.slice(1), value);
        return {
            ...crdt,
            map: { ...crdt.map, [k]: nv },
            hlcStamp: nv.hlcStamp < crdt.hlcStamp ? nv.hlcStamp : crdt.hlcStamp,
        };
    } else {
        if (value.type === 'plain') {
            if (value.hlcStamp > crdt.hlcStamp) {
                const mapValues = { ...crdt.mapValues };
                if (key.length === 1) {
                    mapValues[key[0]] = maybeMerge(value, mapValues[key[0]]);
                } else {
                    mapValues[key[0]] = maybeMerge(
                        set(
                            {
                                type: 'map',
                                map: {},
                                hlcStamp: MIN_STAMP,
                            },
                            key.slice(1),
                            value,
                        ),
                        mapValues[key[0]],
                    );
                }
                return { ...crdt, mapValues };
            }
        } else {
            const map = prune(value.map, crdt.hlcStamp);
            if (map) {
                const mapValues = { ...crdt.mapValues };
                if (key.length === 1) {
                    mapValues[key[0]] = maybeMerge(
                        { ...value, map },
                        mapValues[key[0]],
                    );
                } else {
                    mapValues[key[0]] = maybeMerge(
                        set(
                            {
                                type: 'map',
                                map: {},
                                hlcStamp: MIN_STAMP,
                            },
                            key.slice(1),
                            { ...value, map },
                        ),
                        mapValues[key[0]],
                    );
                }
                return { ...crdt, mapValues };
            }
        }
        return crdt;
    }
};

const createDeepMap = (value: {}, hlcStamp: string): MapCRDT => {
    const map = {};
    Object.keys(value).forEach(k => {
        if (value[k] && typeof value[k] === 'object') {
            map[k] = createDeepMap(value[k], hlcStamp);
        } else {
            map[k] = create(value[k], hlcStamp);
        }
    });
    return { type: 'map', map, hlcStamp };
};

const createMap = (value, hlcStamp): MapCRDT => {
    const map = {};
    Object.keys(value).forEach(k => {
        map[k] = create(value[k], hlcStamp);
    });
    return { type: 'map', map, hlcStamp };
};
const create = (value: any, hlcStamp: string): PlainCRDT => {
    return { type: 'plain', value, hlcStamp };
};
const mergeMaps = (one: MapCRDT, two: MapCRDT) => {
    [one, two] = one.hlcStamp > two.hlcStamp ? [one, two] : [two, one];
    let minStamp = one.hlcStamp;
    const map = { ...one.map };
    Object.keys(two.map).forEach(k => {
        map[k] = maybeMerge(two.map[k], map[k]);
        if (map[k].hlcStamp < minStamp) {
            minStamp = map[k].hlcStamp;
        }
    });
    return {
        type: 'map',
        map,
        hlcStamp: minStamp,
    };
};

const mergePlainMaps = (
    one: { [key: string]: CRDT },
    two: { [key: string]: CRDT },
) => {
    const res = { ...one };
    Object.keys(two).forEach(k => {
        res[k] = maybeMerge(two[k], one[k]);
    });
    return res;
};

const prune = (map: { [key: string]: CRDT }, stamp: string) => {
    const res = {};
    let present = false;
    Object.keys(map).forEach(k => {
        if (map[k].type === 'plain') {
            if (map[k].hlcStamp > stamp) {
                // TODO do we prune the mapValues of this plain?
                // maybe
                res[k] = map[k];
                present = true;
            } else if (map[k].mapValues) {
                const mv = prune(map[k].mapValues, stamp);
                if (mv) {
                    res[k] = { type: 'map', hlcStamp: MIN_STAMP, map: mv };
                    present = true;
                }
            }
        } else {
            const v = prune(map[k].map, stamp);
            if (v) {
                res[k] = { ...map[k], map: v };
                present = true;
            }
        }
    });
    return present ? res : undefined;
};

const mergePlainAndMap = (map: MapCRDT, plain: PlainCRDT): CRDT => {
    if (map.hlcStamp > plain.hlcStamp) {
        if (plain.mapValues) {
            const res = mergePlainMaps(map.map, plain.mapValues);
            return { ...map, map: res };
        } else {
            return map;
        }
    }
    let mapValues = prune(map.map, plain.hlcStamp);
    if (plain.mapValues) {
        mapValues = mapValues
            ? mergePlainMaps(mapValues, plain.mapValues)
            : plain.mapValues;
    }
    if (mapValues && Object.keys(mapValues).length === 0) {
        mapValues = undefined;
    }
    return { ...plain, mapValues };
};
const mergePlain = (one: PlainCRDT, two: PlainCRDT): PlainCRDT => {
    const [neww, old] = one.hlcStamp > two.hlcStamp ? [one, two] : [two, one];
    let mapValues = neww.mapValues;
    if (neww.mapValues && old.mapValues) {
        mapValues = mergePlainMaps(neww.mapValues, old.mapValues);
    } else if (old.mapValues) {
        mapValues = prune(old.mapValues, neww.hlcStamp);
    }
    return { ...neww, mapValues };
};
const merge = (one: CRDT, two: CRDT): CRDT => {
    if (one.type === 'map' && two.type === 'map') {
        return mergeMaps(one, two);
    }
    if (one.type === 'map' && two.type === 'plain') {
        return mergePlainAndMap(one, two);
    }
    if (two.type === 'map' && one.type === 'plain') {
        return mergePlainAndMap(two, one);
    }
    // $FlowFixMe I've exhausted the options folks.
    return mergePlain(one, two);
};

module.exports = {
    merge,
    value,
    create,
    createDeepMap,
    set,
    remove,
    removeAt,
    show,
    deltas,
    showDelta,
    applyDelta,
};
