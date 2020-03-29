// @flow

export type pos = { x: number, y: number };
export type rect = { position: pos, size: pos };

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

export const rectIntersect = (one: rect, two: rect) => {
    return (
        ((two.position.x < one.position.x &&
            one.position.x < two.position.x + two.size.x) ||
            (one.position.x < two.position.x &&
                two.position.x < one.position.x + one.size.x)) &&
        ((two.position.y < one.position.y &&
            one.position.y < two.position.y + two.size.y) ||
            (one.position.y < two.position.y &&
                two.position.y < one.position.y + one.size.y))
    );
};

export type CardT = {
    id: string,
    title: string,
    description: string,
    position: { x: number, y: number },
    size: { x: number, y: number },
    color: ?string,
    header: ?number,
    disabled: boolean,
};

import { type Schema } from '../../../packages/client-bundle';
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
        size: {
            type: 'object',
            attributes: { x: 'number', y: 'number' },
        },
        color: { type: 'optional', value: 'string' },
        header: { type: 'optional', value: 'number' },
        disabled: 'boolean',
    },
};
