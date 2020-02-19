// @flow
const deepEqual = require('@birchill/json-equalish').default;
import type { Node, CRDT, Delta, Span, PreNode } from './types';
import { toKey, length, keyCmp } from './utils';

// MUTATIVE!! TODO try making an immutable version?

export const apply = function<Format>(
    crdt: CRDT<Format>,
    delta: Delta<Format>,
    merge: (Format, Format) => Format,
) {
    switch (delta.type) {
        case 'insert':
            return insert(crdt, delta.span);
        case 'delete':
            return remove(crdt, delta.positions);
        case 'format':
            return format(crdt, delta.positions, delta.format, merge);
        default:
            throw new Error(`Unknown delta: ${delta.type}`);
    }
};

const split = function<Format>(
    crdt: CRDT<Format>,
    key: string,
    splitPoint: number,
) {
    const node = crdt.map[key];
    const newNode = {
        id: [node.id[0] + splitPoint, node.id[1]],
        parent: toKey(node.id),
        text: node.text.slice(splitPoint),
        deleted: node.deleted,
        format: node.format ? { ...node.format } : undefined,
        size: node.size - splitPoint,
        children: node.children,
    };
    node.children.forEach(child => (child.parent = toKey(newNode.id)));
    crdt.map[toKey(newNode.id)] = newNode;
    node.text = node.text.slice(0, splitPoint);
    node.children = [newNode];
};

const splitAtKey = function<Format>(crdt: CRDT<Format>, key: [number, string]) {
    for (let i = key[0]; i >= 0; i--) {
        const pkey = toKey([i, key[1]]);
        if (crdt.map[pkey]) {
            const delta = key[0] - i;
            if (crdt.map[pkey].text.length < delta) {
                return false;
            }
            split(crdt, pkey, delta);
            return true;
        }
    }
    return false;
};

const ensureNodeAt = function<Format>(crdt: CRDT<Format>, id) {
    const key = toKey(id);
    if (!crdt.map[key]) {
        return splitAtKey(crdt, id);
    }
    return true;
};

const parentForAfter = function<Format>(
    crdt: CRDT<Format>,
    after: [number, string],
) {
    for (let i = after[0]; i >= 0; i--) {
        const key = toKey([i, after[1]]);
        if (!crdt.map[key]) {
            continue;
        }
        const node = crdt.map[key];
        if (node.text.length - 1 !== after[0] - node.id[0]) {
            // node needs to be split
            // node's ID will still be the right one, though.
            split(crdt, key, after[0] - node.id[0] + 1);
        }
        return toKey(node.id);
    }
};

export const insert = function<Format>(
    crdt: CRDT<Format>,
    span: PreNode<Format>,
) {
    const key = toKey(span.after);
    if (key === '0:root') {
        // insert into the roots
        const { after, ...spanRest } = span;
        let idx = crdt.roots.length;
        for (let i = 0; i < crdt.roots.length; i++) {
            if (keyCmp(crdt.roots[0].id, span.id) < 1) {
                idx = i;
                break;
            }
        }
        const node = {
            ...spanRest,
            parent: key,
            size: span.text.length,
            children: [],
        };
        crdt.map[toKey(node.id)] = node;
        crdt.roots.splice(idx, 0, node);
        return;
    }
    const parentKey = parentForAfter(crdt, span.after);
    if (!parentKey) {
        console.log('no parent key', span.after);
        return false;
    }
    const parent = crdt.map[parentKey];

    // Auto-compaction!
    if (mergeable(parent, span)) {
        parent.text += span.text;
        parent.size += span.text.length;

        let pkey = parent.parent;
        while (pkey !== '0:root') {
            // console.log('SIZE UPDATE', pkey);
            if (!crdt.map[pkey]) {
                console.log(Object.keys(crdt.map));
            }
            crdt.map[pkey].size += span.text.length;
            pkey = crdt.map[pkey].parent;
        }
        return;
    }

    // Non-compactable insert
    let idx = parent.children.length;
    for (let i = 0; i < parent.children.length; i++) {
        if (keyCmp(parent.children[i].id, span.id) < 1) {
            idx = i;
            break;
        }
    }
    const { after, ...spanRest } = span;
    const node = {
        ...spanRest,
        parent: toKey(parent.id),
        size: span.text.length,
        children: [],
    };
    parent.children.splice(idx, 0, node);
    crdt.map[toKey(node.id)] = node;

    let pkey = parentKey;
    while (pkey !== '0:root') {
        if (!crdt.map[pkey]) {
            console.log(Object.keys(crdt.map));
        }
        crdt.map[pkey].size += span.text.length;
        pkey = crdt.map[pkey].parent;
    }
};

const mergeDown = function<Format>(crdt: CRDT<Format>, node: Node<Format>) {
    // TODO dunno if I can relax the '1 child' restriction
    if (node.children.length !== 1) {
        return;
    }
    const child = node.children[0];
    if (!mergeable(node, child)) {
        return;
    }

    node.children = child.children;
    node.children.forEach(child => (child.parent = toKey(node.id)));
    node.text += child.text;
    delete crdt.map[toKey(child.id)];
    mergeDown(crdt, node);
};

const updateNode = function<Format>(
    crdt: CRDT<Format>,
    node: Node<Format>,
    remove: boolean,
    format: ?{ merge: (Format, Format) => Format, fmt: Format },
) {
    if (remove && !node.deleted) {
        node.deleted = true;
        node.size -= node.text.length;
        let pkey = node.parent;
        while (pkey !== '0:root') {
            crdt.map[pkey].size -= node.text.length;
            pkey = crdt.map[pkey].parent;
        }
    }
    if (format) {
        if (node.format) {
            node.format = format.merge(node.format, format.fmt);
        } else {
            node.format = format.fmt;
        }
    }
    if (node.parent !== '0:root' && !crdt.map[node.parent]) {
        throw new Error(`Invalid parent ${node.parent}`);
    }
    if (node.parent !== '0:root' && mergeable(crdt.map[node.parent], node)) {
        const parent = crdt.map[node.parent];
        parent.text += node.text;
        delete crdt.map[toKey(node.id)];
        parent.children = node.children;
        node.children.forEach(child => (child.parent = toKey(parent.id)));
        mergeDown(crdt, parent);
    } else {
        mergeDown(crdt, node);
    }
};

const mergeable = function<Format>(
    parent: Node<Format>,
    child: Node<Format> | PreNode<Format>,
) {
    return (
        parent.children.length <= 1 &&
        parent.id[1] === child.id[1] &&
        parent.id[0] + parent.text.length === child.id[0] &&
        parent.deleted == child.deleted &&
        deepEqual(parent.format, child.format)
    );
};

const updateSpans = function<Format>(
    crdt: CRDT<Format>,
    spans: Array<Span>,
    remove: boolean,
    format: ?{ merge: (Format, Format) => Format, fmt: Format },
) {
    spans.forEach(({ id, site, length }) => {
        while (length > 0) {
            if (!ensureNodeAt(crdt, [id, site])) {
                throw new Error(`Cannot update span ${id}:${site}`);
            }
            const key = toKey([id, site]);
            const node = crdt.map[key];
            if (node.text.length > length) {
                split(crdt, key, length);
            }
            updateNode(crdt, node, remove, format);
            // Note that this length, importantly, doesn't care about whether the node is deleted
            length -= node.text.length;
            id += node.text.length;
        }
    });
};

export const remove = function<Format>(crdt: CRDT<Format>, spans: Array<Span>) {
    updateSpans(crdt, spans, true, null);
};

export const format = function<Format>(
    crdt: CRDT<Format>,
    spans: Array<Span>,
    format: Format,
    merge: (Format, Format) => Format,
) {
    updateSpans(crdt, spans, false, { merge, fmt: format });
};
