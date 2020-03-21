// @flow

import * as sortedArray from './array-utils';
import type { CRDT, Meta, ArrayMeta, PlainMeta, MapMeta } from './types';

export const MIN_STAMP = '';

export const createOther = function<T, Other>(
    value: T,
    other: Other,
    hlcStamp: string,
): CRDT<T, Other> {
    return { value, meta: { type: 'other', meta: other, hlcStamp } };
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
