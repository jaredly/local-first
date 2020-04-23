// @flow

import type { Delta } from './types';
// import { type CRDT, value as baseValue } from './index';

export type Type =
    | 'id'
    | 'string'
    | 'int'
    | 'float'
    | 'number'
    | 'object'
    | 'boolean'
    | 'array'
    | 'any'
    | 'rich-text'
    | 'id-array'
    | {| type: 'array', item: Type |}
    | Schema
    | {| type: 'map', value: Type |}
    | {| type: 'optional', value: Type |};

export type Schema = {|
    type: 'object',
    attributes: {
        [key: string]: Type,
    },
|};

class ValidationError extends Error {
    value: any;
    path: Array<string | number>;
    constructor(message, value, path: Array<string | number>) {
        super(
            `${message} ${
                // $FlowFixMe
                JSON.stringify(value)
            } ${path.map(m => m.toString()).join(' - ')}`,
        );
        this.value = value;
        this.path = path;
    }
}

const expectType = (v, name, path) => {
    if (v == null) {
        throw new ValidationError(`Expected type ${name}`, v, path);
    }
    if (typeof v !== name) {
        throw new ValidationError(`Expected type ${name}`, v, path);
    }
};

const expectObject = (v, path) => {
    expectType(v, 'object', path);
    if (Array.isArray(v)) {
        throw new ValidationError(`Expected object, not array`, v, path);
    }
};

const expectRichText = (v, path) => {
    expectType(v, 'object', path);
    if (!('site' in v) || !('map' in v) || !('largestLocalId' in v) || !('roots' in v)) {
        throw new Error(`Doesn't look like a rich text object`);
    }
};

const expectArray = (v, path) => {
    if (!v || !Array.isArray(v)) {
        throw new ValidationError(`Expected array`, v, path);
    }
};

export const subSchema = (
    t: Type,
    setPath: Array<string | number>,
    path: Array<string | number> = [],
): Type => {
    if (setPath.length === 0) {
        return t;
    }
    const attr = setPath[0];
    if (t === 'id-array') {
        return 'string';
    }
    if (typeof t !== 'object') {
        throw new ValidationError(`Invalid sub path, not a nested type`, t, path);
    }
    switch (t.type) {
        case 'array':
            return subSchema(t.item, setPath.slice(1), path.concat([attr]));
        case 'optional':
            return subSchema(t.value, setPath, path);
        case 'map':
            return subSchema(t.value, setPath.slice(1), path.concat([attr]));
        case 'object':
            if (typeof attr !== 'string') {
                throw new Error(`Object attributes must be strings`);
            }
            if (!t.attributes[attr]) {
                throw new ValidationError(`Invalid sub path`, t, path.concat([attr]));
            }
            return subSchema(t.attributes[attr], setPath.slice(1), path.concat([attr]));
        default:
            throw new Error(`Invalid type schema ${JSON.stringify(t)}`);
    }
};

export const validateDelta = function<T, Other, OtherDelta>(
    t: Type,
    delta: Delta<T, Other, OtherDelta>,
): ?string {
    try {
        switch (delta.type) {
            case 'set':
                // we're removing something, just need to validate that the path exists
                if (delta.value.meta.type === 't') {
                    validatePath(
                        t,
                        delta.path.map(p => p.key),
                        // either it must be allowed to be empty (e.g. optional), or the path must be toplevel
                        inner => {
                            if (inner.type !== 'optional' && delta.path.length > 0) {
                                throw new ValidationError(
                                    `Clearing out something that's not optional`,
                                    null,
                                    delta.path.map(p => p.key),
                                );
                            }
                        },
                    );
                } else {
                    validateSet(
                        t,
                        delta.path.map(p => p.key),
                        delta.value.value,
                    );
                }
                break;
            case 'insert':
                // TODO this doesn't validate that we're dealing with an array, I don't think? Oh maybe it does
                // console.log('validating insert', delta.path);
                validateSet(
                    t,
                    delta.path.map(p => p.key),
                    delta.value.value,
                );
                break;
            case 'reorder':
                validateSet(
                    t,
                    delta.path.map(p => p.key),
                    [],
                );
                break;
            case 'other':
                validatePath(
                    t,
                    delta.path.map(p => p.key),
                    inner => {
                        if (inner.type !== 'rich-text') {
                            throw new ValidationError(
                                `Cannot apply a "rich text" delta to path`,
                                delta.delta,
                                delta.path.map(p => p.key),
                            );
                        }
                    },
                );
        }
    } catch (err) {
        console.error(err);
        return err.message;
    }
};

export const validatePath = (
    t: Type,
    setPath: Array<string | number>,
    check: Type => void,
    path: Array<string | number> = [],
) => {
    if (setPath.length === 0) {
        return check(t);
    }
    const attr = setPath[0];
    if (t === 'id-array') {
        if (setPath.length > 1) {
            throw new ValidationError(`Can't set more than 1 level into an id-array`, t, path);
        }
        return;
    }
    if (typeof t !== 'object') {
        console.log(setPath, path, t);
        throw new ValidationError(`Invalid sub path, not a nested type`, t, path);
    }
    switch (t.type) {
        case 'array':
            return validatePath(t.item, setPath.slice(1), check, path.concat([attr]));
        case 'optional':
            return validatePath(t.value, setPath, check, path);
        case 'map':
            return validatePath(t.value, setPath.slice(1), check, path.concat([attr]));
        case 'object':
            if (typeof attr !== 'string') {
                throw new Error(`Object attributes must be strings`);
            }
            if (!t.attributes[attr]) {
                throw new ValidationError(`Invalid sub path`, t, path.concat([attr]));
            }
            return validatePath(t.attributes[attr], setPath.slice(1), check, path.concat([attr]));
        default:
            throw new Error(`Invalid type schema ${JSON.stringify(t)}`);
    }
};

export const validateSet = (
    t: Type,
    setPath: Array<string | number>,
    value: any,
    path: Array<string | number> = [],
) => {
    validatePath(t, setPath, t => validate(value, t));
    // if (setPath.length === 0) {
    //     return validate(value, t);
    // }
    // const attr = setPath[0];
    // if (typeof t !== 'object') {
    //     throw new ValidationError(`Invalid sub path, not a nested type`, t, path);
    // }
    // switch (t.type) {
    //     case 'array':
    //         return validateSet(t.item, setPath.slice(1), value, path.concat([attr]));
    //     case 'optional':
    //         return validateSet(t.value, setPath, value, path);
    //     case 'map':
    //         return validateSet(t.value, setPath.slice(1), value, path.concat([attr]));
    //     case 'object':
    //         if (typeof attr !== 'string') {
    //             throw new Error(`Object attributes must be strings`);
    //         }
    //         if (!t.attributes[attr]) {
    //             throw new ValidationError(`Invalid sub path`, t, path.concat([attr]));
    //         }
    //         return validateSet(t.attributes[attr], setPath.slice(1), value, path.concat([attr]));
    //     default:
    //         throw new Error(`Invalid type schema ${JSON.stringify(t)}`);
    // }
};

export const validate = (value: any, t: Type, path: Array<string | number> = []): void => {
    if (typeof t === 'string') {
        switch (t) {
            case 'id':
            case 'string':
                return expectType(value, 'string', path);
            case 'boolean':
                return expectType(value, 'boolean', path);
            case 'int':
            case 'number':
            case 'float':
                return expectType(value, 'number', path);
            case 'object':
                return expectObject(value, path);
            case 'array':
                return expectArray(value, path);
            case 'id-array':
                expectArray(value, path);
                return value.forEach((v, i) => expectType(v, 'string', path.concat(i)));
            case 'rich-text':
                return expectRichText(value, path);
            case 'any':
                return;
            default:
                throw new Error('Invalid schema: ' + t);
        }
    } else if (typeof t === 'object') {
        switch (t.type) {
            case 'array':
                expectArray(value, path);
                return value.forEach(v => validate(v, t.item, path));
            case 'optional':
                if (value != null) {
                    validate(value, t.value, path);
                }
                return;
            case 'map':
                expectObject(value, path);
                return Object.keys(value).forEach(k =>
                    validate(value[k], t.value, path.concat([k])),
                );
            case 'object':
                expectObject(value, path);
                return Object.keys(t.attributes).forEach(k =>
                    validate(value[k], t.attributes[k], path.concat([k])),
                );
            default:
                throw new Error(`Invalid schema: ${JSON.stringify(t)}`);
        }
    }
};
