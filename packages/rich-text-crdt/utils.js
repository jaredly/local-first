// @flow
import type { Node, CRDT, Content } from './types';

export const nodeToString = function(state: CRDT, node: Node) {
    return (
        (node.deleted || node.content.type !== 'text'
            ? ''
            : node.content.text) +
        node.children
            .map(child => nodeToString(state, state.map[child]))
            .join('')
    );
};
export const toString = function(crdt: CRDT) {
    return crdt.roots.map(root => nodeToString(crdt, crdt.map[root])).join('');
};

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

export const keyEq = ([a, b]: [number, string], [c, d]: [number, string]) => {
    return a === c && b === d;
};

export const getFormatValues = (
    state: CRDT,
    formats: { [key: string]: Array<string> },
) => {
    const res = {};
    Object.keys(formats).forEach(key => {
        if (formats[key].length) {
            const node = state.map[formats[key][0]];
            if (node.content.type !== 'open') {
                throw new Error(
                    `A formats list had a non-open node in it ${toKey(
                        node.id,
                    )}`,
                );
            }
            res[key] = node.content.value;
        }
    });
    return res;
};
