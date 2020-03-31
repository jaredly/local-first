// @flow

export const BOUNDS = {
    position: { x: -500, y: -500 },
    size: { x: 5000, y: 3500 },
};

export type rect = { position: pos, size: pos };

export const clamp = (pos: pos, size: pos, range: rect) => {
    return {
        x: Math.min(
            Math.max(range.position.x, pos.x),
            range.position.x + range.size.x - size.x,
        ),
        y: Math.min(
            Math.max(range.position.y, pos.y),
            range.position.y + range.size.y - size.y,
        ),
    };
};

export const toScreen = (pos: pos, pan: pos, zoom: number) => {
    return { x: (pos.x + pan.x) * zoom, y: (pos.y + pan.y) * zoom };
};

export const fromScreen = (pos: pos, pan: pos, zoom: number) => {
    return { x: pos.x / zoom + pan.x, y: pos.y / zoom + pan.y };
};

export const addPos = (pos1: pos, pos2: pos) => ({
    x: pos1.x + pos2.x,
    y: pos1.y + pos2.y,
});
export const posDiff = (p1: pos, p2: pos) => ({
    x: p2.x - p1.x,
    y: p2.y - p1.y,
});
export const absMax = (pos: pos) => Math.max(Math.abs(pos.x), Math.abs(pos.y));
export const normalizedRect = ({ position, size }: rect): rect => ({
    position: {
        x: size.x < 0 ? position.x + size.x : position.x,
        y: size.y < 0 ? position.y + size.y : position.y,
    },
    size: {
        x: Math.abs(size.x),
        y: Math.abs(size.y),
    },
});

export const evtPos = (evt: { clientX: number, clientY: number }): pos => ({
    x: evt.clientX,
    y: evt.clientY,
});

export const rectIntersect = (one: rect, two: rect) => {
    return (
        ((two.position.x <= one.position.x &&
            one.position.x <= two.position.x + two.size.x) ||
            (one.position.x <= two.position.x &&
                two.position.x <= one.position.x + one.size.x)) &&
        ((two.position.y <= one.position.y &&
            one.position.y <= two.position.y + two.size.y) ||
            (one.position.y <= two.position.y &&
                two.position.y <= one.position.y + one.size.y))
    );
};

import { type Schema } from '../../../packages/client-bundle';

export type TagT = {
    id: string,
    title: string,
    color: string,
    style: string, // background, border, color, underline
    createdDate: number,
};

export const TagSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        color: 'string',
        style: 'string',
        createdDate: 'int',
    },
};

export type ScaleT = {
    id: string,
    title: string,
    color: string,
    // like 1 to 5 or whatnot
    min: number,
    max: number,
    createdDate: number,
};

export const ScaleSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        color: 'string',
        min: 'int',
        max: 'int',
        createdDate: 'int',
    },
};

export type CommentT = {
    id: string,
    card: string,
    parentComment: ?string,
    text: string,
    authorId: string,
    createdDate: number,
    deleted: boolean,
};

export const CommentSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        card: 'string',
        parentComment: { type: 'optional', value: 'string' },
        text: 'string',
        authorId: 'string',
        createdDate: 'int',
        deleted: 'boolean',
    },
};

export type CardT = {
    id: string,
    title: string,
    description: string,
    position: {|
        x: number,
        y: number,
    |},
    size: {|
        x: number,
        y: number,
    |},
    // added date, for ordering
    tags: { [tagId: string]: number },
    // these will just be sorted by ID or something
    scales: { [scaleId: string]: number },
    parent?: ?{ id: string, sort: Array<number> },
    header?: ?number,
    disabled: boolean,
};

export const CardSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        description: 'string',
        position: {
            type: 'object',
            attributes: {
                x: 'number',
                y: 'number',
            },
        },
        parent: {
            type: 'optional',
            value: {
                type: 'object',
                attributes: {
                    id: 'string',
                    sort: { type: 'array', item: 'number' },
                },
            },
        },
        size: {
            type: 'object',
            attributes: { x: 'number', y: 'number' },
        },
        number: { type: 'optional', value: 'number' },
        letter: { type: 'optional', value: 'string' },
        header: { type: 'optional', value: 'number' },
        disabled: 'boolean',
    },
};
export type pos = {| x: number, y: number |};

const colorsRaw =
    '1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf';
export const colors = [];
for (let i = 0; i < colorsRaw.length; i += 6) {
    colors.push('#' + colorsRaw.slice(i, i + 6));
}
