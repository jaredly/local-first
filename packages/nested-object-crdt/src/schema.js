// @flow

// import type { Delta } from './index';
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
    | {| type: 'array', item: Schema |}
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
            `${message} ${JSON.stringify(value)} ${path
                .map(m => m.toString())
                .join(' - ')}`,
        );
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

const expectRichText = (v, path) => {
    expectType(v, 'object', path);
    if (
        !('site' in v) ||
        !('map' in v) ||
        !('largestLocalId' in v) ||
        !('roots' in v)
    ) {
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
    if (typeof t !== 'object') {
        throw new ValidationError(
            `Invalid sub path, not a nested type`,
            t,
            path,
        );
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
                throw new ValidationError(
                    `Invalid sub path`,
                    t,
                    path.concat([attr]),
                );
            }
            return subSchema(
                t.attributes[attr],
                setPath.slice(1),
                path.concat([attr]),
            );
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
    switch (t.type) {
        case 'array':
            return validateSet(
                t.item,
                setPath.slice(1),
                value,
                path.concat([attr]),
            );
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
            if (typeof attr !== 'string') {
                throw new Error(`Object attributes must be strings`);
            }
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
            throw new Error(`Invalid type schema ${JSON.stringify(t)}`);
    }
};

export const validate = (
    value: any,
    t: Type,
    path: Array<string | number> = [],
) => {
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
            case 'rich-text':
                return expectRichText(value, path);
            case 'any':
                return true;
            default:
                throw new Error('Invalid schema: ' + t);
        }
    } else if (typeof t === 'object') {
        switch (t.type) {
            case 'array':
                return value.every(v => validate(v, t.item, path));
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
