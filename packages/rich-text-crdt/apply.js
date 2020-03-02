// @flow
import type { Content, CRDT, Node, Delta } from './types';
import { toKey, fromKey, keyCmp, contentLength } from './utils';
import { rootParent } from './loc';

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
        size: contentLength(content),
        children: [],
        content,
        formats,
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
        content: { type: 'text', text: text.slice(splitPoint) },
        parent: toKey(node.id),
        deleted: node.deleted,
        formats: node.formats,
        size: node.size - splitPoint,
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

export const apply = (state: CRDT, delta: Delta): CRDT => {
    // console.log('applying', JSON.stringify(delta));
    state = { ...state, map: { ...state.map } };
    if (delta.insert) {
        delta.insert.forEach(tmpNode => {
            // console.log('inserting', tmpNode);
            const afterKey = toKey(tmpNode.after);
            if (afterKey === rootParent) {
                const idx = insertionPos(state.roots, tmpNode.id);
                const key = toKey(tmpNode.id);
                state.roots = insertId(state.roots, key, idx);
                // hmmm should we be determining parent formats here?
                // TODO get current formats list
                const node = mkNode(tmpNode.id, afterKey, tmpNode.content, {});
                state.map[key] = node;

                // console.log('inserted at root');
                return;
            }
            const parentKey = parentForAfter(state, tmpNode.after);
            if (!parentKey) {
                throw new Error(
                    `Cannot find parent for ${toKey(tmpNode.after)}`,
                );
            }
            const parent = state.map[parentKey];
            // if (maybeMerge(parent, tmpNode, newState)) {
            //     return newState;
            // }

            const idx = insertionPos(parent.children, tmpNode.id);
            const key = toKey(tmpNode.id);
            const node = mkNode(
                tmpNode.id,
                parentKey,
                tmpNode.content,
                // TODO really get formats
                parent.formats,
            );
            state.map[parentKey] = {
                ...parent,
                children: insertId(parent.children, key, idx),
            };
            state.map[key] = node;
        });
    }
    return state;
    // TODO
};
