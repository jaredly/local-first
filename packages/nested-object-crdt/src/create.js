// @flow

import * as sortedArray from './array-utils';
import type { CRDT, Meta, ArrayMeta, PlainMeta, MapMeta } from './types';
import type { Type, Schema } from './schema';

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
    getStamp: () => string,
): Meta<Other> {
    if (value == null || typeof value !== 'object') {
        return { type: 'plain', hlcStamp };
    }
    if (Array.isArray(value)) {
        return createDeepArrayMeta(value, hlcStamp, getStamp, item =>
            createDeepMeta(item, hlcStamp, getStamp),
        );
    }
    return createDeepMapMeta(value, hlcStamp, getStamp, item =>
        createDeepMeta(item, hlcStamp, getStamp),
    );
};

const randomStamp = () => {
    return Math.random()
        .toString(36)
        .slice(2);
};

const metaForSchema = function<T, Other>(
    value: T,
    hlcStamp: string,
    getStamp: () => string,
    schema: Type,
    createOtherMeta: any => Other,
): Meta<Other> {
    if (schema === 'rich-text') {
        return { type: 'other', meta: createOtherMeta(value), hlcStamp };
    }
    // Gotta get us some test coverage of this stuff
    if (schema === 'id-array') {
        if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
            throw new Error(`Value not an id array`);
        }
        // $FlowFixMe
        return createIdArrayMeta(value, hlcStamp);
    }
    if (typeof schema === 'string') {
        return { type: 'plain', hlcStamp };
    }
    if (schema == null) {
        throw new Error(`Null schema. Value: ${JSON.stringify(value) ?? 'undefined'}`);
    }
    switch (schema.type) {
        case 'array':
            if (!Array.isArray(value)) {
                throw new Error(`Value not an array`);
            }
            return createDeepArrayMeta(value, hlcStamp, getStamp, item =>
                metaForSchema(item, hlcStamp, getStamp, schema.item, createOtherMeta),
            );
        case 'optional':
            return value != null
                ? metaForSchema(value, hlcStamp, getStamp, schema.value, createOtherMeta)
                : { type: 't', hlcStamp };
        case 'map':
            if (value == null || typeof value !== 'object') {
                throw new Error(`Not an object`);
            }
            return createDeepMapMeta(value, hlcStamp, getStamp, (item, key) =>
                metaForSchema(item, hlcStamp, getStamp, schema.value, createOtherMeta),
            );
        case 'object':
            if (value == null || typeof value !== 'object') {
                throw new Error(`Not an object`);
            }
            return createDeepMapMeta(value, hlcStamp, getStamp, (item, key) => {
                const sub = schema.attributes[key];
                if (sub == null) {
                    throw new Error(`Sub schema not defined: ${key}`);
                }
                return metaForSchema(item, hlcStamp, getStamp, sub, createOtherMeta);
            });
        default:
            throw new Error('Unexpected schema type: ' + JSON.stringify(schema));
    }
};

export const createWithSchema = function<T, Other>(
    value: T,
    hlcStamp: string,
    getStamp: () => string,
    schema: Type,
    createOtherMeta: any => Other,
): CRDT<T, Other> {
    // need to assume that 'rich-text' is 'other', right?
    // If there's need for more/other than that, I can update this.
    return {
        value,
        meta: metaForSchema(value, hlcStamp, getStamp, schema, createOtherMeta),
    };
};

export const createDeep = function<T, Other>(
    value: T,
    hlcStamp: string,
    getStamp: () => string = randomStamp,
): CRDT<T, Other> {
    return { value, meta: createDeepMeta(value, hlcStamp, getStamp) };
};

const createIdArrayMeta = function<T, Other>(
    value: $ReadOnlyArray<string>,
    hlcStamp: string,
): ArrayMeta<Other> {
    const meta = {
        type: 'array',
        idsInOrder: [],
        items: {},
        hlcStamp,
    };
    let last = null;
    value.forEach(id => {
        const sort = sortedArray.between(last, null);
        last = sort;
        meta.items[id] = {
            meta: { type: 'plain', hlcStamp },
            sort: { idx: sort, stamp: hlcStamp },
        };
        meta.idsInOrder.push(id);
    });
    return meta;
};

export const createDeepArrayMeta = function<T, Other>(
    value: $ReadOnlyArray<T>,
    hlcStamp: string,
    getStamp: () => string,
    createInner: any => Meta<Other>,
): ArrayMeta<Other> {
    const meta = {
        type: 'array',
        idsInOrder: [],
        items: {},
        hlcStamp,
    };
    let last = null;
    value.forEach(item => {
        const id = getStamp();
        const innerMeta = createInner(item);
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
    getStamp: () => string,
    createInner: (any, string) => Meta<Other>,
): MapMeta<Other> {
    const meta: MapMeta<Other> = {
        type: 'map',
        map: {},
        hlcStamp,
    };
    Object.keys(value).forEach(k => {
        meta.map[k] = createInner(value[k], k);
    });
    return meta;
};

export const create = function<T, Other>(
    value: T,
    hlcStamp: string,
): {| value: T, meta: PlainMeta |} {
    return { value, meta: { type: 'plain', hlcStamp } };
};

export const createEmpty = function<T, Other>(hlcStamp: string = MIN_STAMP): CRDT<?T, Other> {
    return { value: null, meta: { type: 't', hlcStamp } };
};
