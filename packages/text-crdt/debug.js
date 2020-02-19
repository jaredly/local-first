// @flow
import type { Node, CRDT } from './types';
import { toKey } from './utils';

export const nodeToDebug = (node: Node<Object>) =>
    '[' +
    toKey(node.id) +
    '·' +
    (node.deleted ? '~' + node.text + '~' : node.text) +
    ']' +
    (node.format ? JSON.stringify(node.format) : '') +
    (node.children.length
        ? '<' + node.children.map(nodeToDebug).join(';') + '>'
        : '');
export const toDebug = (crdt: CRDT<Object>) =>
    crdt.roots.map(nodeToDebug).join(';;');
