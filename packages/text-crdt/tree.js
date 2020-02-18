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
    format?: Format,
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
    format?: Format,
    // the number of *non-deleted* characters contained in this tree
    size: number,
    children: Array<Node<Format>>,
|};

type Spans = Array<[number, string, number]>;

type Delta<Format> =
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

type CRDT<Format> = {|
    roots: Array<Node<Format>>,
    map: { [key: string]: Node<Format> },
|};

const toKey = ([id, site]) => `${id}:${site}`;

export const nodeToString = (node: Node<mixed>) =>
    (node.deleted ? '' : node.text) + node.children.map(nodeToString).join('');
export const toString = (crdt: CRDT<mixed>) =>
    crdt.roots.map(nodeToString).join('');

export const init = function<Format>(): CRDT<Format> {
    return { roots: [], map: {} };
};

type Op =
    | {| delete: number |}
    | {| retain: number, attributes?: mixed |}
    | {| insert: string, attributes?: mixed |};
type QuillDelta = { ops: Array<Op> };

export const fromQuillDelta = (delta: QuillDelta): Array<Delta<mixed>> => {
    return [];
};

// Remote ops

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

const keyCmp = ([a, b], [c, d]) => {
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
    const parentKey = parentForAfter(crdt, span.after);
    if (!parentKey) {
        return false;
    }
    const parent = crdt.map[parentKey];
    let idx = parent.children.length;
    for (let i = 0; i < parent.children.length; i++) {
        if (keyCmp(parent.children[0], span.id) < 1) {
            idx = i;
            break;
        }
    }
    const { after, ...spanRest } = span;
    parent.children.splice(idx, 0, {
        ...spanRest,
        parent: toKey(parent.id),
        size: span.text.length,
        children: [],
    });

    let pkey = key;
    while (pkey !== '0:root') {
        crdt.map[pkey].size += span.text.length;
        pkey = toKey(crdt.map[pkey].parent);
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
        let pkey = toKey(node.parent);
        while (pkey != '0:root') {
            crdt.map[pkey].size -= node.text.length;
            pkey = toKey(crdt.map[pkey].parent);
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
