// @flow
// Based on RGA
// And this great explanation
// https://www.youtube.com/watch?v=yCcWpzY8dIA

const deepEqual = require('@birchill/json-equalish').default;
import type { Node, CRDT, Delta, Span, Spans } from './types';
import { toKey, length, keyCmp } from './utils';
import { parentLocForPos, selectionToSpans } from './query';
export * from './types';
export * from './update';
export * from './query';
export * from './utils';
export * from './check';

export const localDelete = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
): Delta<Format> {
    const spans = selectionToSpans(crdt, at, count);
    if (!spans) {
        throw new Error(`Invalid position ${at}`);
    }
    return { type: 'delete', positions: spans };
};

export const localFormat = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
    format: Format,
): Delta<Format> {
    const spans = selectionToSpans(crdt, at, count);
    if (!spans) {
        throw new Error(`Invalid position ${at}`);
    }
    return {
        type: 'format',
        positions: spans,
        format,
    };
};

export const localInsert = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    text: string,
    format: ?Format,
): Delta<Format> {
    const spos = at === 0 ? [[0, 'root'], 0] : parentLocForPos(crdt, at - 1);
    if (!spos) {
        console.log('no pos for', at);
        throw new Error(`No position for ${at}`);
    }
    const rightPos = parentLocForPos(crdt, at);
    crdt.largestLocalId = Math.max(
        spos[0][0] + spos[1],
        rightPos ? rightPos[0][0] + rightPos[1] : 0,
        crdt.largestLocalId,
    );
    const id = crdt.largestLocalId + 1;
    crdt.largestLocalId += text.length;
    return {
        type: 'insert',
        span: {
            id: [id, crdt.site],
            after: [spos[0][0] + spos[1], spos[0][1]],
            text,
            format,
        },
    };
};

export const walk = function<Format>(
    node: Node<Format>,
    fn: (Node<Format>) => void,
) {
    fn(node);
    node.children.forEach(child => walk(child, fn));
};

export const inflate = function<Format>(
    site: string,
    roots: Array<Node<Format>>,
): CRDT<Format> {
    let largest = 0;
    const map = {};
    roots.forEach(node =>
        walk(node, node => {
            map[toKey(node.id)] = node;
            if (node.id[1] === site && node.id[0] > largest) {
                largest = node.id[0];
            }
        }),
    );
    return { site, roots, map, largestLocalId: largest };
};

export const init = function<Format>(site: string) {
    return { site, roots: [], map: {}, largestLocalId: 0 };
};
