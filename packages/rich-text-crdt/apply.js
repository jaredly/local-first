// @flow
import type { Content, CRDT, Node, Delta, Span } from './types';
import { toKey, fromKey, keyCmp, contentLength, contentChars, keyEq } from './utils';
import { rootParent, rootSite, walkFrom, lastChild, lastId, nodeForKey } from './loc';
import deepEqual from 'fast-deep-equal';

const insertionPos = (ids, id) => {
    for (let i = 0; i < ids.length; i++) {
        if (keyCmp(fromKey(ids[i]), id) < 1) {
            return i;
        }
    }
    return ids.length;
};

const mkNode = (id, parent, content, formats = {}): Node => {
    return {
        id,
        parent,
        size: contentChars(content),
        content,
        formats,
        children: [],
    };
};

// mutates the toplevel map, but not the nodes
const split = (state: CRDT, key: string, splitPoint: number) => {
    const node = state.map[key];
    if (node.content.type !== 'text') {
        throw new Error(`Cannot split a ${node.content.type} node`);
    }
    const text = node.content.text;
    const newNode: Node = {
        id: [node.id[0] + splitPoint, node.id[1]],
        parent: toKey(node.id),
        size: node.deleted ? node.size : node.size - splitPoint,
        content: { type: 'text', text: text.slice(splitPoint) },
        formats: node.formats,
        children: node.children,
    };
    if (node.deleted) {
        newNode.deleted = true;
    }
    const newKey = toKey(newNode.id);
    state.map[newKey] = newNode;
    state.map[key] = {
        ...node,
        content: { type: 'text', text: text.slice(0, splitPoint) },
        children: [newKey],
    };
    newNode.children.forEach(child => {
        state.map[child] = {
            ...state.map[child],
            parent: newKey,
        };
    });
};

const splitAtKey = (state: CRDT, key: [number, string]) => {
    for (let i = key[0]; i >= 0; i--) {
        const pkey = toKey([i, key[1]]);
        if (state.map[pkey]) {
            const delta = key[0] - i;
            if (
                state.map[pkey].content.type !== 'text' ||
                state.map[pkey].content.text.length < delta
            ) {
                return false;
            }
            split(state, pkey, delta);
            return true;
        }
    }
    return false;
};

const ensureNodeAt = (state: CRDT, id) => {
    const key = toKey(id);
    if (!state.map[key]) {
        return splitAtKey(state, id);
    }
    return true;
};

const parentForAfter = (state: CRDT, after: [number, string]): ?string => {
    for (let i = after[0]; i >= 0; i--) {
        const key = toKey([i, after[1]]);
        if (!state.map[key]) {
            continue;
        }
        const node = state.map[key];
        if (
            node.content.type === 'text' &&
            node.content.text.length - 1 !== after[0] - node.id[0]
        ) {
            // node needs to be split
            // node's ID will still be the right one, though.
            split(state, key, after[0] - node.id[0] + 1);
        }
        return toKey(node.id);
    }
};

const insertId = (ids: Array<string>, id: string, idx: number) => {
    return [...ids.slice(0, idx), id, ...ids.slice(idx)];
};

const insertNode = (state: CRDT, id, after, content: Content) => {
    const afterKey = toKey(after);

    if (state.largestIDs[id[1]] != null && id[0] <= state.largestIDs[id[1]]) {
        // const key = toKey(id);
        // if (state.map[key]) {
        //     const node = state.map[key];
        //     const currentAfter =
        //         node.parent === rootParent
        //             ? [0, rootSite]
        //             : lastId(state.map[node.parent]);
        //     if (!keyEq(currentAfter, after)) {
        //         throw new Error(
        //             `Inserting a node that was already inserted, with a different 'after'`,
        //         );
        //     }
        //     if (node.content.type !== content.type) {
        //         throw new Error(
        //             `Inserting a node that was already inserted, with a different content type`,
        //         );
        //     }
        //     if (node.content.type === 'text' && content.type === 'text') {
        //         const currentText = node.content.text;
        //         const newText = content.text;
        //         if (newText.length < currentText.length) {
        //             if (!currentText.startsWith(newText)) {
        //                 throw new Error(`Text mismatch of re-inserted node`);
        //             }
        //         } else if (!newText.startsWith(currentText)) {
        //             throw new Error(`Text mismatch of re-inserted node`);
        //         }
        //     } else if (!deepEqual(node.content, content)) {
        //         throw new Error(
        //             `Reinserting a format node, and the content differs`,
        //         );
        //     }
        // }
        // STOPSHIP TODO establish consistency here
        // console.log('skipping dup');
        return;
    }

    // console.warn('Setting new largestID for', id[1]);
    state.largestIDs = {
        ...state.largestIDs,
        [id[1]]: Math.max(
            state.largestIDs[id[1]] || 0,
            content.type === 'text' ? id[0] + content.text.length - 1 : id[0],
        ),
    };
    if (afterKey === rootParent) {
        const idx = insertionPos(state.roots, id);
        const currentFormats =
            idx === 0 ? {} : state.map[lastChild(state, state.roots[idx - 1])].formats;
        const key = toKey(id);
        state.roots = insertId(state.roots, key, idx);
        const node = mkNode(id, afterKey, content, currentFormats);
        state.map[key] = node;
        return;
    }
    const parentKey = parentForAfter(state, after);
    if (parentKey == null) {
        throw new Error(`Cannot find parent for ${toKey(after)}`);
    }
    const parent = state.map[parentKey];

    if (
        parent.content.type === 'text' &&
        content.type === 'text' &&
        parent.id[1] === id[1] &&
        parent.id[0] + parent.content.text.length === id[0] &&
        !parent.deleted &&
        (parent.children.length === 0 || state.map[parent.children[0]].id[0] < id[0])
    ) {
        const size = content.text.length;
        state.map[parentKey] = {
            ...parent,
            content: { type: 'text', text: parent.content.text + content.text },
            size: parent.size + size,
        };
        let cp = parent.parent;
        while (cp !== rootParent) {
            const node = state.map[cp];
            state.map[cp] = {
                ...node,
                size: node.size + size,
            };
            cp = node.parent;
        }
        return;
    }

    const idx = insertionPos(parent.children, id);
    const currentFormats =
        idx === 0 ? parent.formats : state.map[lastChild(state, parent.children[idx - 1])].formats;
    const node = mkNode(id, parentKey, content, currentFormats);
    const size = contentChars(content);
    const key = toKey(id);
    state.map[parentKey] = {
        ...parent,
        children: insertId(parent.children, key, idx),
        size: parent.size + size,
    };
    state.map[key] = node;

    if (size) {
        let cp = parent.parent;
        while (cp !== rootParent) {
            const node = state.map[cp];
            state.map[cp] = {
                ...node,
                size: node.size + size,
            };
            cp = node.parent;
        }
    }
};

const insertIdx = (state: CRDT, formats: Array<string>, stamp: string) => {
    for (let i = 0; i < formats.length; i++) {
        const node = state.map[formats[i]];
        if (node.content.type === 'open' && node.content.stamp < stamp) {
            return i;
        }
    }
    return formats.length;
};

const addFormat = (state: CRDT, formats: ?Array<string>, stamp: string, id: string) => {
    if (!formats) {
        return [id];
    }
    const idx = insertIdx(state, formats, stamp);
    return insertId(formats, id, idx);
};

const isSpanAllDeleted = (state: CRDT, span: Span) => {
    const parentNode = nodeForKey(state, [span.id, span.site]);
    if (!parentNode || !parentNode.deleted) return false;
    const length = contentLength(parentNode.content);
    if (span.length <= length) {
        return true;
    }
    return isSpanAllDeleted(state, {
        id: span.id + length,
        site: span.site,
        length: span.length - length,
    });
};

const deleteSpan = (state: CRDT, span: Span) => {
    if (isSpanAllDeleted(state, span)) {
        return;
    }
    if (!ensureNodeAt(state, [span.id, span.site])) {
        throw new Error(`Failed to ensure node at ${span.id}:${span.site}`);
    }
    const key = toKey([span.id, span.site]);
    const node = state.map[key];
    if (node.content.type !== 'text') {
        throw new Error(`Not a text node, cannot delete a non-text node`);
    }
    const text = node.content.text;
    if (text.length < span.length) {
        deleteSpan(state, {
            id: span.id + text.length,
            site: span.site,
            length: span.length - text.length,
        });
    } else if (text.length > span.length) {
        // This splits it
        ensureNodeAt(state, [span.id + span.length, span.site]);
    }
    if (!state.map[key].deleted) {
        const { content } = state.map[key];
        if (content.type !== 'text') {
            throw new Error('Somehow types got changed just now');
        }
        const deletedLength = content.text.length;
        // text.length > span.length ? span.length : text.length;
        state.map[key] = {
            ...state.map[key],
            size: state.map[key].size - deletedLength,
            deleted: true,
        };

        // Remove the length of this text from all parent's sizes.
        let cp = node.parent;
        while (cp !== rootParent) {
            const node = state.map[cp];
            state.map[cp] = {
                ...node,
                size: node.size - deletedLength,
            };
            cp = node.parent;
        }

        if (state.map[key].children.length === 1) {
            maybeMergeUp(state, state.map[key].children[0]);
        }
        maybeMergeUp(state, key);
    }
};

const maybeMergeUp = (state, key) => {
    const node = state.map[key];
    if (node.content.type !== 'text') {
        return;
    }
    const text = node.content.text;
    if (node.parent === rootParent) {
        return;
    }
    const parent = state.map[node.parent];
    if (
        parent.children.length !== 1 ||
        parent.content.type !== 'text' ||
        parent.deleted !== node.deleted
    ) {
        return;
    }
    const parentText = parent.content.text;
    if (parent.id[1] !== node.id[1] || node.id[0] !== parent.id[0] + parentText.length) {
        return;
    }
    // Ok we're merging
    state.map[node.parent] = {
        ...parent,
        content: { type: 'text', text: parentText + text },
        children: node.children,
    };
    node.children.forEach(child => {
        state.map[child] = {
            ...state.map[child],
            parent: node.parent,
        };
    });
    delete state.map[key];
};

const deleteFormat = (state, stamp, open, close) => {
    // Ok
    const openKey = toKey(open);
    const closeKey = toKey(close);
    const openNode = state.map[openKey];
    const closeNode = state.map[closeKey];
    if (
        openNode.content.type !== 'open' ||
        closeNode.content.type !== 'close' ||
        openNode.content.stamp !== stamp ||
        closeNode.content.stamp !== stamp
    ) {
        throw new Error(`Invalid "delete-format" delta`);
    }
    if (openNode.deleted && closeNode.deleted) {
        return;
    }
    const key = openNode.content.key;
    state.map[openKey] = {
        ...openNode,
        deleted: true,
    };
    state.map[closeKey] = {
        ...closeNode,
        deleted: true,
    };
    walkFrom(
        state,
        openKey,
        node => {
            const nkey = toKey(node.id);
            if (nkey === closeKey) {
                return false; // we're done
            }
            if (node.formats[key] && node.formats[key].includes(openKey)) {
                const changed = node.formats[key].filter(k => k !== openKey);
                let formats = { ...node.formats };
                if (changed.length) {
                    formats[key] = changed;
                } else {
                    delete formats[key];
                }
                state.map[toKey(node.id)] = {
                    ...node,
                    formats,
                };
            }
        },
        true,
    );
};

export const apply = (current: CRDT, delta: Delta | Array<Delta>): CRDT => {
    if (Array.isArray(delta)) {
        let state = current;
        delta.forEach(delta => (state = apply(state, delta)));
        return state;
    }
    let state = { ...current, map: { ...current.map } };
    if (delta.type === 'insert') {
        insertNode(state, delta.id, delta.after, {
            type: 'text',
            text: delta.text,
        });
    } else if (delta.type === 'delete') {
        delta.spans.forEach(span => {
            deleteSpan(state, span);
        });
    } else if (delta.type === 'delete-format') {
        deleteFormat(state, delta.stamp, delta.open, delta.close);
    } else if (delta.type === 'format') {
        const openKey = toKey(delta.open.id);
        // Format already exists. TODO check consistency
        if (state.map[openKey] && state.map[toKey(delta.close.id)]) {
            return state;
        }
        insertNode(state, delta.open.id, delta.open.after, {
            type: 'open',
            key: delta.key,
            value: delta.value,
            stamp: delta.stamp,
        });
        insertNode(state, delta.close.id, delta.close.after, {
            type: 'close',
            key: delta.key,
            stamp: delta.stamp,
        });
        // now we go through each node between the start and end
        // and update the formattings
        walkFrom(
            state,
            toKey(delta.open.id),
            node => {
                if (keyEq(node.id, delta.close.id)) {
                    return false;
                }
                // yeah, adding in the formats
                const key = toKey(node.id);
                state.map[key] = {
                    ...node,
                    formats: {
                        ...node.formats,
                        [delta.key]: addFormat(
                            state,
                            node.formats[delta.key],
                            delta.stamp,
                            openKey,
                        ),
                    },
                };
            },
            true,
        );
    }
    try {
        checkConsistency(state);
    } catch (err) {
        console.error('Inconsistent state encountered while applying a text delta!');
        console.log(current);
        console.log(delta);
        console.log(state);
        console.error(err);
        // debugger;
    }
    return state;
};

import { checkConsistency } from './check';
