// @flow

import type { Delta } from './index';

export type Type =
    | 'id'
    | 'string'
    | 'int'
    | 'float'
    | 'object'
    | 'boolean'
    | 'array'
    | 'any'
    | [Schema]
    | ['id']
    | Schema
    | { type: 'map', value: Type }
    | { type: 'optional', value: Type };

export type Schema = {
    type: 'object',
    attributes: {
        [key: string]: Type,
    },
};

class ValidationError extends Error {
    value: any;
    path: Array<string>;
    constructor(message, value, path) {
        super(`${message} ${JSON.stringify(value)} ${path.join(' - ')}`);
        this.value = value;
        this.path = path;
    }
}

const expectType = (v, name, path) => {
    if (v && typeof v !== name) {
        throw new ValidationError(`Expected type ${name}`, v, path);
    }
};

const expectObject = (v, path) => {
    expectType(v, 'object', path);
    if (Array.isArray(v)) {
        throw new ValidationError(`Expected object, not array`, v, path);
    }
};

const expectArray = (v, path) => {
    if (!v || !Array.isArray(v)) {
        throw new ValidationError(`Expected array`, v, path);
    }
};

export const validateSet = (
    t: Type,
    setPath: Array<string>,
    value: any,
    path: Array<string> = [],
) => {
    if (setPath.length === 0) {
        return validate(value, t);
    }
    const attr = setPath[0];
    if (typeof t !== 'object') {
        throw new ValidationError(
            `Invalid sub path, not a nested type`,
            t,
            path,
        );
    }
    if (Array.isArray(t)) {
        return validateSet(t[0], setPath.slice(1), value, path.concat([attr]));
    }
    switch (t.type) {
        case 'optional':
            return validateSet(t.value, setPath, value, path);
        case 'map':
            return validateSet(
                t.value,
                setPath.slice(1),
                value,
                path.concat([attr]),
            );
        case 'object':
            if (!t.attributes[attr]) {
                throw new ValidationError(
                    `Invalid sub path`,
                    t,
                    path.concat([attr]),
                );
            }
            return validateSet(
                t.attributes[attr],
                setPath.slice(1),
                value,
                path.concat([attr]),
            );
        default:
            throw new Error(`Invalid type schema`);
    }
};

export const validate = (value: any, t: Type, path: Array<string> = []) => {
    if (typeof t === 'string') {
        switch (t) {
            case 'id':
            case 'string':
                return expectType(value, 'string', path);
            case 'boolean':
                return expectType(value, 'boolean', path);
            case 'int':
                return expectType(value, 'number', path);
            case 'float':
                return expectType(value, 'number', path);
            case 'object':
                return expectObject(value, path);
            case 'array':
                return expectArray(value, path);
            case 'any':
                return true;
            default:
                throw new Error('Invalid schema');
        }
    } else if (Array.isArray(t) && t.length === 1) {
        expectArray(value, path);
        if (t[0] === 'id') {
            if (!value.every(v => typeof v === 'string')) {
                throw new ValidationError(
                    `Expected array of strings`,
                    value,
                    path,
                );
            }
            return;
        } else {
            return value.every(v => validate(v, t[0], path));
        }
    } else if (typeof t === 'object') {
        switch (t.type) {
            case 'optional':
                return value == null || validate(value, t.value, path);
            case 'map':
                expectObject(value, path);
                return Object.keys(value).every(k =>
                    validate(value[k], t.value, path.concat([k])),
                );
            case 'object':
                expectObject(value, path);
                return Object.keys(t.attributes).every(k =>
                    validate(value[k], t.attributes[k], path.concat([k])),
                );
            default:
                throw new Error(`Invalid schema: ${JSON.stringify(t)}`);
        }
    }
};
