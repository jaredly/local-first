// @flow
import type { Node, CRDT } from './types';

export const nodeToString = function<Format>(
    node: Node<Format>,
    format?: (string, Format) => string,
) {
    return (
        (node.deleted
            ? ''
            : format && node.format
            ? format(node.text, node.format)
            : node.text) +
        node.children.map(child => nodeToString(child, format)).join('')
    );
};
export const toString = function<Format>(
    crdt: CRDT<Format>,
    format?: (string, Format) => string,
) {
    return crdt.roots.map(root => nodeToString(root, format)).join('');
};

export const toKey = ([id, site]: [number, string]) => `${id}:${site}`;

export const length = function<Format>(state: CRDT<Format>) {
    let res = 0;
    state.roots.forEach(r => (res += r.size));
    return res;
};

export const keyCmp = ([a, b]: [number, string], [c, d]: [number, string]) => {
    return a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0;
};
