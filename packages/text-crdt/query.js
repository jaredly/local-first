// @flow
import type { Node, CRDT } from './types';
import { toKey, length } from './utils';

// Get the next sibling or parent's next sibling
// const nextSibling = function<Format>(
//     crdt: CRDT<Format>,
//     node: Node<Format>,
// ): ?Node<Format> {
//     if (node.parent === '0:root') {
//         const idx = crdt.roots.indexOf(node);
//         if (idx === -1 || idx + 1 >= crdt.roots.length) {
//             return; // selection went too far
//         }
//         return crdt.roots[idx + 1];
//     } else {
//         const parent = crdt.map[node.parent];
//         const idx = parent.children.indexOf(node);
//         if (idx === -1) {
//             throw new Error(`Can't find node in parents`);
//         }
//         if (idx + 1 >= parent.children.length) {
//             return nextSibling(crdt, parent);
//         }
//         return parent.children[idx + 1];
//     }
// };

// // character offset + count, collect the spans
// // of node ids that correspond to it.
// const selectionToPosInNodes = function<Format>(
//     crdt: CRDT<Format>,
//     node: Node<Format>,
//     offset: number,
//     count: number,
//     spans: Spans,
// ) {
//     if (offset > node.text.length) {
//         throw new Error(
//             `Offset can't be greater than this node's text length.`,
//         );
//     }
//     if (!node.deleted) {
//         if (offset + count <= node.text.length) {
//             spans.push([node.id[0] + offset, node.id[1], count]);
//             return 0;
//         } else {
//             spans.push([
//                 node.id[0] + offset,
//                 node.id[1],
//                 node.text.length - offset,
//             ]);
//             count = count - (node.text.length - offset);
//         }
//     }
//     for (let i = 0; i < node.children.length; i++) {
//         const child = node.children[i];
//         count = selectionToPosInNodes(crdt, child, 0, count, spans);
//         if (count <= 0) {
//             return 0;
//         }
//     }
//     return count;
// };

// export const selectionToSpans = function<Format>(
//     crdt: CRDT<Format>,
//     at: number,
//     count: number,
// ): ?Spans {
//     const spos = parentLocForPos(crdt, at);
//     if (!spos) {
//         return null;
//     }
//     const spans = [];
//     let node: Node<Format> = crdt.map[toKey(spos[0])];
//     let left = selectionToPosInNodes(crdt, node, spos[1], count, spans);
//     while (left > 0) {
//         const next = nextSibling(crdt, node);
//         if (!next) {
//             return spans;
//         }
//         node = next;
//         left = selectionToPosInNodes(crdt, node, 0, left, spans);
//     }
//     return spans;
// };

// const nodePosition = function<Format>(crdt: CRDT<Format>, node: Node<Format>) {
//     let total = 0;
//     while (node) {
//         const siblings =
//             node.parent === '0:root'
//                 ? crdt.roots
//                 : crdt.map[node.parent].children;
//         const idx = siblings.indexOf(node);
//         if (idx === -1) {
//             throw new Error(
//                 `node not found in parents children ${toKey(node.id)} ${
//                     node.parent
//                 } - ${siblings.map(s => toKey(s.id)).join(';')}`,
//             );
//         }
//         for (let i = 0; i < idx; i++) {
//             total += siblings[i].size;
//         }
//         if (node.parent === '0:root') {
//             break;
//         } else {
//             node = crdt.map[node.parent];
//             if (!node.deleted) {
//                 total += node.text.length;
//             }
//         }
//     }
//     return total;
// };

// export const textPositionForLoc = function<Format>(
//     crdt: CRDT<Format>,
//     [[id, site], offset]: [[number, string], number],
// ) {
//     if (id === 0 && site === 'root') {
//         return 0;
//     }
//     for (let i = id + Math.max(0, offset); i >= 0; i--) {
//         const key = toKey([i, site]);
//         if (crdt.map[key]) {
//             const pos = nodePosition(crdt, crdt.map[key]);
//             // console.log('found parent at', i, id, offset, pos, key);
//             return pos + (id + offset - i);
//         }
//     }
//     throw new Error(`Unable to get position for loc ${id}-${site}+${offset}`);
// };

// const locForPosInNode = (node, pos) => {
//     if (!node.deleted && pos <= node.text.length) {
//         return [node.id, pos];
//     }
//     if (!node.deleted) {
//         pos -= node.text.length;
//     }
//     for (let i = 0; i < node.children.length; i++) {
//         const child = node.children[i];
//         const found = locForPosInNode(child, pos);
//         if (found) {
//             return found;
//         }
//         pos -= child.size;
//     }
// };

// export const parentLocForPos = function<Format>(
//     crdt: CRDT<Format>,
//     pos: number,
// ): ?[[number, string], number] {
//     if (pos === 0) {
//         return [[0, 'root'], 1];
//     }
//     let total = 0;
//     for (let i = 0; i < crdt.roots.length; i++) {
//         const node = crdt.roots[i];
//         if (pos > node.size) {
//             pos -= node.size;
//             continue;
//         }
//         const found = locForPosInNode(node, pos);
//         if (found) {
//             return found;
//         }
//         pos -= node.size;
//     }
// };
