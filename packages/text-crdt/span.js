// @flow
import type { Node, CRDT, Span } from './types';
import {
    posToPostLoc,
    posToPreLoc,
    charactersBeforeNode,
    nodeForKey,
    rootParent,
    type Loc,
} from './loc';
import { toKey, length } from './utils';

// Get the next sibling or parent's next sibling
const nextSibling = function<Format>(
    crdt: CRDT<Format>,
    node: Node<Format>,
): ?Node<Format> {
    if (node.parent === rootParent) {
        const idx = crdt.roots.indexOf(node);
        if (idx === -1 || idx + 1 >= crdt.roots.length) {
            return; // selection went too far
        }
        return crdt.roots[idx + 1];
    } else {
        const parent = crdt.map[node.parent];
        const idx = parent.children.indexOf(node);
        if (idx === -1) {
            throw new Error(`Can't find node in parents`);
        }
        if (idx + 1 >= parent.children.length) {
            return nextSibling(crdt, parent);
        }
        return parent.children[idx + 1];
    }
};

// character offset + count, collect the spans
// of node ids that correspond to it.
const collectSpans = function<Format>(
    crdt: CRDT<Format>,
    node: Node<Format>,
    offset: number,
    count: number,
    spans: Array<Span>,
) {
    if (offset > node.text.length) {
        throw new Error(
            `Offset can't be greater than this node's text length.`,
        );
    }
    if (!node.deleted) {
        if (offset + count <= node.text.length) {
            spans.push({
                id: node.id[0] + offset,
                site: node.id[1],
                length: count,
            });
            return 0;
        } else {
            spans.push({
                id: node.id[0] + offset,
                site: node.id[1],
                length: node.text.length - offset,
            });
            count = count - (node.text.length - offset);
        }
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        count = collectSpans(crdt, child, 0, count, spans);
        if (count <= 0) {
            return 0;
        }
    }
    return count;
};

export const selectionToSpans = function<Format>(
    crdt: CRDT<Format>,
    start: number,
    end: number,
): Array<Span> {
    let [id, offset] = posToPostLoc(crdt, start);
    const spans = [];
    let count = end - start;
    let node = crdt.map[toKey(id)];
    while (count > 0) {
        count = collectSpans(crdt, node, offset, count, spans);
        if (!count) break;
        let next = nextSibling(crdt, node);
        if (!next) {
            if (count === 1) {
                break;
            }
            throw new Error(
                `Selection length overreaches data: ${toKey(node.id)} ${count}`,
            );
        }
        node = next;
        offset = 0;
    }
    return spans;
};

const collectSelections = function<Format>(
    crdt: CRDT<Format>,
    span: Span,
    selections,
) {
    const node = nodeForKey(crdt, [span.id, span.site]);
    if (!node) {
        throw new Error(`Cannot find node for span ${JSON.stringify(span)}`);
    }
    const offset = span.id - node.id[0];
    const start = charactersBeforeNode(crdt, node) + offset;
    // it all fits within this node
    if (node.text.length - offset >= span.length) {
        selections.push({ start, end: start + span.length });
    } else {
        // Go to the end of this node, and then
        // request the node that represents the next part of
        // the span
        const amount = node.text.length - offset;
        selections.push({ start, end: start + amount });
        collectSelections(
            crdt,
            {
                id: span.id + amount,
                site: span.site,
                length: span.length - amount,
            },
            selections,
        );
    }
};

const mergeSelections = selections => {
    if (!selections.length) {
        return [];
    }
    const result = [selections[0]];
    for (let i = 1; i < selections.length; i++) {
        if (result[result.length - 1].end === selections[i].start) {
            result[result.length - 1].end = selections[i].end;
        } else {
            result.push(selections[i]);
        }
    }
    return result;
};

export const spansToSelections = function<Format>(
    crdt: CRDT<Format>,
    spans: Array<Span>,
): Array<{ start: number, end: number }> {
    const selections = [];
    spans.forEach(span => collectSelections(crdt, span, selections));
    // TODO merge selections
    return mergeSelections(selections);
};

/*






















*/

// character offset + count, collect the spans
// of node ids that correspond to it.
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

// export const _selectionToSpans = function<Format>(
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
