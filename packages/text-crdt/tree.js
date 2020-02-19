// @flow
// Based on RGA
// And this great explanation
// https://www.youtube.com/watch?v=yCcWpzY8dIA

// hrmm ok so I need a new definition for what I'm doing.
// I thought that parent ==== after
// but instead, after = [parent.id[0] + parent.text.length - 1, parent.id[1]]

const deepEqual = require('@birchill/json-equalish').default;

type Span<Format> = {|
    id: [number, string],
    after: [number, string],
    text: string,
    deleted?: boolean,
    // TODO merging formats might be a little dicey?
    // I'll parameterize on it, -- you provide your own "format" crdt
    format?: ?Format,
|};

export type Node<Format> = {|
    id: [number, string],
    // this is the actual node we're under
    parent: string,
    // this is the ID we come after, which, if the parent's length is >1, will be parent id + number... right?
    // ok that seems redundant though
    // after: [number, string],
    text: string,
    deleted?: boolean,
    format?: ?Format,
    // the number of *non-deleted* characters contained in this tree
    size: number,
    children: Array<Node<Format>>,
|};

export type CRDT<Format> = {|
    site: string,
    largestLocalId: number,
    roots: Array<Node<Format>>,
    map: { [key: string]: Node<Format> },
|};

type Spans = Array<[number, string, number]>;

export type Delta<Format> =
    | {
          type: 'insert',
          span: Span<Format>,
      }
    | {
          type: 'delete',
          positions: Spans,
      }
    | {
          type: 'format',
          positions: Spans,
          format: Format,
      };

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

export const toKey = ([id, site]: [number, string]) => `${id}:${site}`;

export const nodeToString = function<Format>(
    node: Node<Format>,
    format?: (string, Format) => string,
) {
    return (
        (node.deleted
            ? ''
            : format && node.format
            ? format(node.text, node.format)
            : node.text) +
        node.children.map(child => nodeToString(child, format)).join('')
    );
};
export const toString = function<Format>(
    crdt: CRDT<Format>,
    format?: (string, Format) => string,
) {
    return crdt.roots.map(root => nodeToString(root, format)).join('');
};

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

// type Op =
//     | {| delete: number |}
//     | {| retain: number, attributes?: mixed |}
//     | {| insert: string, attributes?: mixed |};
// type QuillDelta = { ops: Array<Op> };

export const length = function<Format>(state: CRDT<Format>) {
    let res = 0;
    state.roots.forEach(r => (res += r.size));
    return res;
};

export const checkNode = (node: Node<empty>) => {
    const key = toKey(node.id);
    let size = node.deleted ? 0 : node.text.length;
    node.children.forEach(child => {
        if (child.parent !== key) {
            throw new Error(
                `Child does not have parent as key: child ${toKey(
                    child.id,
                )} - expected parent ${key} - found parent reads ${
                    child.parent
                }`,
            );
        }
        checkNode(child);
        size += child.size;
    });
    if (size !== node.size) {
        throw new Error(`Node size is wrong ${toKey(node.id)}`);
    }
    const ids = node.children.map(n => n.id);
    const copy = ids.slice();
    copy.sort((a, b) => keyCmp(b, a));
    // newChildren.sort((a, b) => keyCmp(a.id, b.id))
    if (!deepEqual(copy, ids)) {
        throw new Error(`Children out of order: ${ids} vs ${copy}`);
    }
};

export const checkConsistency = (state: CRDT<any>) => {
    state.roots.forEach(checkNode);
    const len = length(state);
    for (let i = 0; i < len; i++) {
        const m = parentLocForPos(state, i);
        if (!m) {
            throw new Error(`No parent loc for cursor ${i}`);
        }
        const back = textPositionForLoc(state, m);
        if (back !== i) {
            throw new Error(
                `To loc and back again failed; orig ${i} loc ${m} result ${back}`,
            );
        }
    }
};

const nodePosition = function<Format>(crdt: CRDT<Format>, node: Node<Format>) {
    let total = 0;
    while (node) {
        const siblings =
            node.parent === '0:root'
                ? crdt.roots
                : crdt.map[node.parent].children;
        const idx = siblings.indexOf(node);
        if (idx === -1) {
            throw new Error(
                `node not found in parents children ${toKey(node.id)} ${
                    node.parent
                } - ${siblings.map(s => toKey(s.id)).join(';')} - ${toDebug(
                    crdt,
                )}`,
            );
        }
        for (let i = 0; i < idx; i++) {
            total += siblings[i].size;
        }
        if (node.parent === '0:root') {
            break;
        } else {
            node = crdt.map[node.parent];
            if (!node.deleted) {
                total += node.text.length;
            }
        }
    }
    return total;
};

export const textPositionForLoc = function<Format>(
    crdt: CRDT<Format>,
    [[id, site], offset]: [[number, string], number],
) {
    for (let i = id + Math.max(0, offset); i >= 0; i--) {
        const key = toKey([i, site]);
        if (crdt.map[key]) {
            const pos = nodePosition(crdt, crdt.map[key]);
            // console.log('found parent at', i, id, offset, pos, key);
            return pos + (id + offset - i) + 1;
        }
    }
    throw new Error(`Unable to get position for loc ${id}-${site}+${offset}`);
};

const locForPosInNode = (node, pos) => {
    if (!node.deleted && pos <= node.text.length) {
        return [node.id, pos - 1];
    }
    if (!node.deleted) {
        pos -= node.text.length;
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const found = locForPosInNode(child, pos);
        if (found) {
            return found;
        }
        pos -= child.size;
    }
};

export const parentLocForPos = function<Format>(
    crdt: CRDT<Format>,
    pos: number,
): ?[[number, string], number] {
    let total = 0;
    for (let i = 0; i < crdt.roots.length; i++) {
        const node = crdt.roots[i];
        if (pos > node.size) {
            pos -= node.size;
            continue;
        }
        const found = locForPosInNode(node, pos);
        if (found) {
            return found;
        }
        pos -= node.size;
    }
};

const selectionToPosInNodes = (crdt, node, offset, count, spans) => {
    if (!node.deleted && offset < node.text.length) {
        if (offset + count <= node.text.length) {
            spans.push([node.id[0] + offset, node.id[1], count]);
            return 0;
        } else {
            spans.push([
                node.id[0] + offset,
                node.id[1],
                node.text.length - offset,
            ]);
            count = count - (node.text.length - offset);
        }
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        count = selectionToPosInNodes(crdt, child, 0, count, spans);
        if (count <= 0) {
            return 0;
        }
    }
    return count;
};

const nextSibling = function<Format>(
    crdt: CRDT<Format>,
    node: Node<Format>,
): ?Node<Format> {
    if (node.parent === '0:root') {
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

export const selectionToSpans = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
) {
    const spos = parentLocForPos(crdt, at + 1);
    if (!spos) {
        return null;
    }
    const spans = [];
    let node: Node<Format> = crdt.map[toKey(spos[0])];
    let left = selectionToPosInNodes(crdt, node, spos[1], count, spans);
    while (left > 0) {
        const next = nextSibling(crdt, node);
        if (!next) {
            return spans;
        }
        node = next;
        left = selectionToPosInNodes(crdt, node, 0, left, spans);
    }
    return spans;
};

export const localDelete = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
): Delta<Format> {
    const spans = selectionToSpans(crdt, at, count);
    if (!spans) {
        throw new Error(`Invalid position ${at}`);
    }
    return { type: 'delete', positions: spans };
};

export const localFormat = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
    format: Format,
): Delta<Format> {
    const spans = selectionToSpans(crdt, at, count);
    if (!spans) {
        throw new Error(`Invalid position ${at}`);
    }
    return {
        type: 'format',
        positions: spans,
        format,
    };
};

export const localInsert = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    text: string,
    format: ?Format,
): Delta<Format> {
    const spos = at === 0 ? [[0, 'root'], 0] : parentLocForPos(crdt, at);
    if (!spos) {
        console.log('no pos for', at);
        throw new Error(`No position for ${at}`);
    }
    const rightPos = parentLocForPos(crdt, at + 1);
    crdt.largestLocalId = Math.max(
        spos[0][0] + spos[1],
        rightPos ? rightPos[0][0] + rightPos[1] : 0,
        crdt.largestLocalId,
    );
    const id = crdt.largestLocalId + 1;
    crdt.largestLocalId += text.length;
    return {
        type: 'insert',
        span: {
            id: [id, crdt.site],
            after: [spos[0][0] + spos[1], spos[0][1]],
            text,
            format,
        },
    };
};

export const walk = function<Format>(
    node: Node<Format>,
    fn: (Node<Format>) => void,
) {
    fn(node);
    node.children.forEach(child => walk(child, fn));
};

export const inflate = function<Format>(
    site: string,
    roots: Array<Node<Format>>,
): CRDT<Format> {
    let largest = 0;
    const map = {};
    roots.forEach(node =>
        walk(node, node => {
            map[toKey(node.id)] = node;
            if (node.id[1] === site && node.id[0] > largest) {
                largest = node.id[0];
            }
        }),
    );
    return { site, roots, map, largestLocalId: largest };
};

export const init = function<Format>(site: string) {
    return { site, roots: [], map: {}, largestLocalId: 0 };
};

// MUTATIVE!! TODO try making an immutable version?

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

const keyCmp = ([a, b]: [number, string], [c, d]: [number, string]) => {
    return a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0;
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

export const insert = function<Format>(crdt: CRDT<Format>, span: Span<Format>) {
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
    child: Node<Format> | Span<Format>,
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
    spans: Spans,
    remove: boolean,
    format: ?{ merge: (Format, Format) => Format, fmt: Format },
) {
    spans.forEach(([id, site, length]) => {
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

export const remove = function<Format>(crdt: CRDT<Format>, spans: Spans) {
    updateSpans(crdt, spans, true, null);
};

export const format = function<Format>(
    crdt: CRDT<Format>,
    spans: Spans,
    format: Format,
    merge: (Format, Format) => Format,
) {
    updateSpans(crdt, spans, false, { merge, fmt: format });
};
