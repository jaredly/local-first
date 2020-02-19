// @flow
// Based on RGA
// And this great explanation
// https://www.youtube.com/watch?v=yCcWpzY8dIA

const deepEqual = require('@birchill/json-equalish').default;
import type { Node, CRDT, Delta, Span, PreNode } from './types';
import { toKey, length, keyCmp } from './utils';
// import { parentLocForPos, selectionToSpans } from './query';
import { locToPos, posToLoc } from './loc';
import { selectionToSpans, spansToSelections } from './span';
export * from './types';
export * from './span';
export * from './update';
export * from './loc';
// export * from './query';
export * from './utils';
export * from './check';

export const localDelete = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
): Delta<Format> {
    const spans = selectionToSpans(crdt, at, at + count);
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
    const spans = selectionToSpans(crdt, at, at + count);
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
    const loc = posToLoc(crdt, at, true);
    const rightLoc = posToLoc(crdt, at, false);
    crdt.largestLocalId = Math.max(loc.id, rightLoc.id, crdt.largestLocalId);
    const id = crdt.largestLocalId + 1;
    crdt.largestLocalId += text.length;
    return {
        type: 'insert',
        span: {
            id: [id, crdt.site],
            after: [loc.id, loc.site],
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
