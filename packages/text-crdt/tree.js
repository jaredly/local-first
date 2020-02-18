// @flow
// Based on RGA
// And this great explanation
// https://www.youtube.com/watch?v=yCcWpzY8dIA

// hrmm ok so I need a new definition for what I'm doing.
// I thought that parent ==== after
// but instead, after = [parent.id[0] + parent.text.length - 1, parent.id[1]]

type Span<Format> = {|
    id: [number, string],
    after: [number, string],
    text: string,
    deleted?: boolean,
    // TODO merging formats might be a little dicey?
    // I'll parameterize on it, -- you provide your own "format" crdt
    format?: ?Format,
|};

type Node<Format> = {|
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

export type CRDT<Format> = {|
    site: string,
    largestLocalId: number,
    roots: Array<Node<Format>>,
    map: { [key: string]: Node<Format> },
|};

const toKey = ([id, site]: [number, string]) => `${id}:${site}`;

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
    (node.deleted ? `del${node.text.length}` : node.text) +
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

const locForPosInNode = (node, pos) => {
    if (!node.deleted && pos <= node.text.length) {
        // console.log('works within', pos, node.text.length);
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

export const locForPos = function<Format>(
    crdt: CRDT<Format>,
    pos: number,
): ?[[number, string], number] {
    let total = 0;
    for (let i = 0; i < crdt.roots.length; i++) {
        const node = crdt.roots[i];
        if (pos > node.size) {
            // console.log('pos larger than size');
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

export const selectionToSpans = function<Format>(
    crdt: CRDT<Format>,
    at: number,
    count: number,
) {
    const spos = locForPos(crdt, at);
    if (!spos) {
        return null;
    }
    const spans = [];
    selectionToPosInNodes(
        crdt,
        crdt.map[toKey(spos[0])],
        spos[1],
        count,
        spans,
    );
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
    const spos = at === 0 ? [[0, 'root'], 0] : locForPos(crdt, at);
    if (!spos) {
        console.log('no pos for', at);
        throw new Error(`No position for ${at}`);
    }
    // console.log('spos', spos);
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
) {
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
    crdt.map[toKey(newNode.id)] = newNode;
    if (!node.deleted) {
        node.size -= node.text.length - splitPoint;
    }
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
    console.log(parentKey, parent.id);
    let idx = parent.children.length;
    for (let i = 0; i < parent.children.length; i++) {
        if (keyCmp(parent.children[0].id, span.id) < 1) {
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
        // console.log('SIZE UPDATE', pkey);
        if (!crdt.map[pkey]) {
            console.log(Object.keys(crdt.map));
        }
        crdt.map[pkey].size += span.text.length;
        pkey = crdt.map[pkey].parent;
    }
};

const updateNode = function<Format>(
    crdt: CRDT<Format>,
    key: string,
    remove: boolean,
    format: ?{ merge: (Format, Format) => Format, fmt: Format },
) {
    const node = crdt.map[key];
    if (remove && !node.deleted) {
        node.deleted = true;
        node.size -= node.text.length;
        let pkey = node.parent;
        while (pkey != '0:root') {
            // console.log('OK size update', pkey);
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
};

const updateSpans = function<Format>(
    crdt: CRDT<Format>,
    spans: Spans,
    remove: boolean,
    format: ?{ merge: (Format, Format) => Format, fmt: Format },
) {
    spans.forEach(([id, site, length]) => {
        // ok so the several cofigurations
        // there's a node that is exactly the span! congrats
        if (!ensureNodeAt(crdt, [id, site])) {
            throw new Error(`Cannot update span ${id}:${site}`);
        }
        while (length > 0) {
            const key = toKey([id, site]);
            const node = crdt.map[key];
            if (node.text.length > length) {
                split(crdt, key, length);
                // split
            }
            updateNode(crdt, key, remove, format);
            length -= node.text.length;
            id += node.text.length;
        }

        /*
  exact match
  [----------] span
  {----------} node

  exact start, subset
  [----------] span
  {-------------} node

  exact start, after node matches
  [----------]
  {----}{----}

  exact start, afternode subset
  [----------]
  {----}{------}

  subset
    [-----]
  {-----------}

    [--------]
  {----------}

    [--------]
  {----}{------}

  ok is there a way to make it so

  hello folks
  - delete hello
  - insert 40 after 'hel'

  convergently also deletes the 'hel'?
  probably not, because we don't have causality...
  yeah, I'll leave that alone for now.
  Even though it will cause a weirdness.


        */
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
