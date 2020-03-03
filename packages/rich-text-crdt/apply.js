// @flow
import type { Content, CRDT, Node, Delta } from './types';
import {
    toKey,
    fromKey,
    keyCmp,
    contentLength,
    contentChars,
    keyEq,
} from './utils';
import { rootParent, walkFrom } from './loc';

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
        size: node.size - splitPoint,
        content: { type: 'text', text: text.slice(splitPoint) },
        deleted: node.deleted,
        formats: node.formats,
        children: node.children,
    };
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
    if (afterKey === rootParent) {
        const idx = insertionPos(state.roots, id);
        const key = toKey(id);
        state.roots = insertId(state.roots, key, idx);
        // hmmm should we be determining parent formats here?
        // TODO get current formats list
        const node = mkNode(id, afterKey, content, {});
        state.map[key] = node;
        return;
    }
    const parentKey = parentForAfter(state, after);
    if (!parentKey) {
        throw new Error(`Cannot find parent for ${toKey(after)}`);
    }
    const parent = state.map[parentKey];
    // if (maybeMerge(parent, tmpNode, newState)) {
    //     return newState;
    // }

    const idx = insertionPos(parent.children, id);
    const key = toKey(id);
    const node = mkNode(
        id,
        parentKey,
        content,
        // TODO really get formats
        parent.formats,
    );
    state.map[parentKey] = {
        ...parent,
        children: insertId(parent.children, key, idx),
    };
    state.map[key] = node;
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

const addFormat = (
    state: CRDT,
    formats: ?Array<string>,
    stamp: string,
    id: string,
) => {
    if (!formats) {
        return [id];
    }
    const idx = insertIdx(state, formats, stamp);
    return insertId(formats, id, idx);
};

export const apply = (state: CRDT, delta: Delta): CRDT => {
    state = { ...state, map: { ...state.map } };
    if (delta.type === 'update') {
        if (delta.insert) {
            delta.insert.forEach(tmpNode => {
                insertNode(state, tmpNode.id, tmpNode.after, {
                    type: 'text',
                    text: tmpNode.text,
                });
            });
        }
    } else if (delta.type === 'format') {
        const openKey = toKey(delta.open.id);
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
        walkFrom(state, toKey(delta.open.id), node => {
            if (keyEq(node.id, delta.close.id)) {
                return false;
            }
            if (keyEq(node.id, delta.open.id)) {
                // TODO does the open tag need a self-reference?
                // we could early return here
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
        });
    }
    return state;
    // TODO
};
