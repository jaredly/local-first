// @flow

export type pos = {|
    x: number,
    y: number,
|};
export type rect = { position: pos, size: pos };

export const clamp = (pos: pos, size: pos, range: rect) => {
    return {
        x: Math.min(Math.max(range.position.x, pos.x), range.position.x + range.size.x - size.x),
        y: Math.min(Math.max(range.position.y, pos.y), range.position.y + range.size.y - size.y),
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
        ((two.position.x <= one.position.x && one.position.x <= two.position.x + two.size.x) ||
            (one.position.x <= two.position.x && two.position.x <= one.position.x + one.size.x)) &&
        ((two.position.y <= one.position.y && one.position.y <= two.position.y + two.size.y) ||
            (one.position.y <= two.position.y && two.position.y <= one.position.y + one.size.y))
    );
};
