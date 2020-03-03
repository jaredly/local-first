// @flow
import type { Node, CRDT, Content } from './types';

// export const nodeToString = function<Format>(
//     node: Node<Format>,
//     format?: (string, Format) => string,
// ) {
//     return (
//         (node.deleted
//             ? ''
//             : format && node.format
//             ? format(node.text, node.format)
//             : node.text) +
//         node.children.map(child => nodeToString(child, format)).join('')
//     );
// };
// export const toString = function<Format>(
//     crdt: CRDT<Format>,
//     format?: (string, Format) => string,
// ) {
//     return crdt.roots.map(root => nodeToString(root, format)).join('');
// };

export const toKey = ([id, site]: [number, string]) => `${id}:${site}`;
export const fromKey = (id: string): [number, string] => {
    const [a0, a1] = id.split(':');
    return [+a0, a1];
};

export const length = function(state: CRDT) {
    let res = 0;
    state.roots.forEach(r => (res += state.map[r].size));
    return res;
};

export const contentChars = (content: Content) => {
    switch (content.type) {
        case 'text':
            return content.text.length;
        default:
            return 0;
    }
};

export const contentLength = (content: Content) => {
    switch (content.type) {
        case 'text':
            return content.text.length;
        default:
            return 1;
    }
};

// export const strKeyCmp = (a: string, b: string): number => {
//     const [a0, a1] = a.split(':');
//     const [b0, b1] = b.split(':');
//     return keyCmp([+a0, a1], [+b0, b1]);
// };

export const keyCmp = ([a, b]: [number, string], [c, d]: [number, string]) => {
    return a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0;
};
