// @flow

import type { CRDT, Span, Node } from './types';
import {
    posToPostLoc,
    nextSibling,
    walkFrom,
    nodeForKey,
    charactersBeforeNode,
} from './loc';
import { toKey, contentChars } from './utils';

// character offset + count, collect the spans
// of node ids that correspond to it.
// const collectSpans = function<Format>(
//     crdt: CRDT,
//     node: Node,
//     offset: number,
//     count: number,
//     spans: Array<Span>,
// ) {
//     if (node.content.type !== 'text') {
//         throw new Error('Not a text node');
//     }
//     const content = node.content;
//     if (offset > content.text.length) {
//         throw new Error(
//             `Offset can't be greater than this node's text length.`,
//         );
//     }
//     if (!node.deleted) {
//         if (offset + count <= content.text.length) {
//             spans.push({
//                 id: node.id[0] + offset,
//                 site: node.id[1],
//                 length: count,
//             });
//             return 0;
//         } else {
//             spans.push({
//                 id: node.id[0] + offset,
//                 site: node.id[1],
//                 length: content.text.length - offset,
//             });
//             count = count - (content.text.length - offset);
//         }
//     }
//     for (let i = 0; i < node.children.length; i++) {
//         const child = crdt.map[node.children[i]];
//         if (child.content.type === 'text') {
//             count = collectSpans(crdt, child, 0, count, spans);
//         }
//         if (count <= 0) {
//             return 0;
//         }
//     }
//     return count;
// };

// export const selectionToSpans = function<Format>(
//     crdt: CRDT,
//     start: number,
//     end: number,
// ): Array<Span> {
//     let [id, offset] = posToPostLoc(crdt, start);
//     const spans = [];
//     let count = end - start;
//     let node = crdt.map[toKey(id)];
//     while (count > 0 && node) {
//         if (node.content.type === 'text') {
//             count = collectSpans(crdt, node, offset, count, spans);
//         }
//         if (!count) break;
//         let next = nextSibling(crdt, node);
//         if (!next) {
//             if (count === 1) {
//                 break;
//             }
//             throw new Error(
//                 `Selection length overreaches data: ${toKey(node.id)} ${count}`,
//             );
//         }
//         node = crdt.map[next];
//         offset = 0;
//     }
//     return spans;
// };

export const selectionToSpans = function<Format>(
    state: CRDT,
    start: number,
    end: number,
): Array<Span> {
    let [loc, offset] = posToPostLoc(state, start);
    const spans = [];
    let count = end - start;

    walkFrom(state, toKey(loc), node => {
        if (node.content.type !== 'text' || node.deleted) {
            return;
        }
        const text = node.content.text;
        if (offset >= text.length) {
            offset -= text.length;
            return;
        }

        if (offset + count <= text.length) {
            spans.push({
                id: node.id[0] + offset,
                site: node.id[1],
                length: count,
            });
            return false;
        } else {
            spans.push({
                id: node.id[0] + offset,
                site: node.id[1],
                length: text.length - offset,
            });
            count = count - (text.length - offset);
        }
    });

    return spans;
};

const collectSelections = (crdt: CRDT, span: Span, selections) => {
    const node = nodeForKey(crdt, [span.id, span.site]);
    if (!node) {
        throw new Error(`Cannot find node for span ${JSON.stringify(span)}`);
    }
    const offset = span.id - node.id[0];
    const start = charactersBeforeNode(crdt, node) + offset;
    // it all fits within this node
    if (node.content.type !== 'text') {
        // throw new Error(`Cannot `)
        console.error('span is not a text node!', node.content, span);
        return;
    }
    const text = node.content.text;
    if (text.length - offset >= span.length) {
        selections.push({ start, end: start + span.length });
    } else {
        // Go to the end of this node, and then
        // request the node that represents the next part of
        // the span
        const amount = text.length - offset;
        if (amount > 0) {
            selections.push({ start, end: start + amount });
        }
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

export const spansToSelections = (
    crdt: CRDT,
    spans: Array<Span>,
): Array<{ start: number, end: number }> => {
    const selections = [];
    spans.forEach(span => collectSelections(crdt, span, selections));
    // TODO merge selections
    return mergeSelections(selections);
};
