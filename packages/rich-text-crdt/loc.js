// @flow
import deepEqual from 'fast-deep-equal';
import type { Content, CRDT, Node, Delta, Loc } from './types';

import {
    toKey,
    fromKey,
    length,
    keyCmp,
    contentLength,
    getFormatValues,
} from './utils';

export const rootSite = '-root-';
export const rootParent = '0:-root-';

export const lastId = (node: Node) => {
    if (node.content.type === 'text') {
        return [node.id[0] + node.content.text.length - 1, node.id[1]];
    }
    return node.id;
};

// Ok I actually need a better plan
// char-space -> crdt-space
// and back.
// 'abc'
// we need to select an "anchoring"
// certainly the 'start' of a selection anchors right
// and the 'end' anchors left.
// dunno what a good default is for the cursor when
// not selecting, but that can be decided.

/*

| a | b | c | d | e |
0   1   2   3   4   5

yeah just 1 or 0 for the side, true or false.

0(left) is [0:root,1]
0(right) is [1:a, 0]
1(left) is [1:a, 1]
1(right) is [2:a, 0]

*/

const walkLoop = (
    state: CRDT,
    id: string,
    fn: Node => ?false,
    all: boolean = false,
) => {
    const node = state.map[id];
    if (!node) return console.error(`Missing node! ${id}`);
    if (!node.deleted || all) {
        if (fn(node) === false) {
            return false;
        }
    }
    if (
        state.map[id].children.some(
            child => walkLoop(state, child, fn, all) === false,
        )
    ) {
        return false;
    }
};

export const walkFrom = (
    state: CRDT,
    key: string,
    fn: Node => ?false,
    all: boolean = false,
) => {
    if (walkLoop(state, key, fn, all) === false) {
        return;
    }
    const walkUp = key => {
        if (key === rootParent) {
            return;
        }
        const node = state.map[key];
        const siblings =
            node.parent === rootParent
                ? state.roots
                : state.map[node.parent].children;
        const idx = siblings.indexOf(key);
        if (idx === -1) {
            throw new Error(
                `${key} not found in children of ${
                    node.parent
                } : ${siblings.join(', ')}`,
            );
        }
        for (let i = idx + 1; i < siblings.length; i++) {
            if (walkLoop(state, siblings[i], fn, all) === false) {
                return;
            }
        }
        return walkUp(node.parent);
    };
    walkUp(key);
};

export const walk = (state: CRDT, fn: Node => ?false, all: boolean = false) => {
    state.roots.some(id => walkLoop(state, id, fn, all) === false);
};

export const fmtIdx = (
    fmt: Array<{ stamp: string }>,
    content: { stamp: string },
) => {
    for (let i = 0; i < fmt.length; i++) {
        if (fmt[i].stamp < content.stamp) {
            return i;
        }
    }
    return fmt.length;
};

export const lastChild = (crdt: CRDT, id: string) => {
    const node = crdt.map[id];
    if (node.children.length) {
        return lastChild(crdt, node.children[node.children.length - 1]);
    } else {
        return id;
    }
};

export const prevSibling = (crdt: CRDT, node: Node): ?string => {
    if (node.parent === rootParent) {
        const idx = crdt.roots.indexOf(node);
        if (idx === -1 || idx === 0) {
            return; // selection went too far
        }
        return lastChild(crdt, crdt.roots[idx - 1]);
    } else {
        const parent = crdt.map[node.parent];
        const idx = parent.children.indexOf(node);
        if (idx === -1) {
            throw new Error(`Can't find node in parents`);
        }
        if (idx === 0) {
            return prevSibling(crdt, parent);
        }
        return parent.children[idx + 1];
    }
};

export const nextNode = (crdt: CRDT, node: Node): ?string => {
    if (node.children.length) {
        return node.children[0];
    }
    return nextSibling(crdt, node);
};

// Get the next sibling or parent's next sibling
export const nextSibling = function(crdt: CRDT, node: Node): ?string {
    // console.log('sib', node);
    if (node.parent === rootParent) {
        const idx = crdt.roots.indexOf(node);
        if (idx === -1 || idx + 1 >= crdt.roots.length) {
            // console.log('root out');
            return; // selection went too far
        }
        return crdt.roots[idx + 1];
    } else {
        const parent = crdt.map[node.parent];
        const key = toKey(node.id);
        const idx = parent.children.indexOf(key);
        if (idx === -1) {
            throw new Error(
                `Can't find node ${key} in parents ${parent.children.join(
                    ';',
                )}`,
            );
        }
        if (idx + 1 >= parent.children.length) {
            return nextSibling(crdt, parent);
        }
        return parent.children[idx + 1];
    }
};

const posToPreLocForNode = (
    state: CRDT,
    node: Node,
    pos: number,
): [[number, string], number] => {
    // Only text nodes should be pre-locs
    if (pos === 1 && !node.deleted && node.content.type === 'text') {
        return [node.id, 0];
    }
    if (pos > node.size) {
        throw new Error(`pos ${pos} not in node ${toKey(node.id)}`);
    }
    if (!node.deleted && node.content.type === 'text') {
        if (pos <= node.content.text.length) {
            return [node.id, pos - 1];
        }
        pos -= node.content.text.length;
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = state.map[node.children[i]];
        if (pos <= child.size) {
            return posToPreLocForNode(state, child, pos);
        }
        pos -= child.size;
    }
    throw new Error(
        `Node size caches must have been miscalculated! Pos ${pos} not found in node ${toKey(
            node.id,
        )}, even though node's size is ${node.size}`,
    );
};

// This represents the loc that is before the pos...
export const posToPreLoc = (
    crdt: CRDT,
    pos: number,
): [[number, string], number] => {
    if (pos === 0) {
        return [[0, rootSite], 0];
    }
    for (let i = 0; i < crdt.roots.length; i++) {
        const root = crdt.map[crdt.roots[i]];
        if (pos <= root.size) {
            return posToPreLocForNode(crdt, root, pos);
        }
        pos -= root.size;
    }
    throw new Error(`Pos ${pos} is outside the bounds`);
};

const posToPostLocForNode = (state: CRDT, node: Node, pos: number) => {
    if (pos === 0 && !node.deleted) {
        return [node.id, 0];
    }
    if (pos >= node.size) {
        throw new Error(`post pos ${pos} not in node ${toKey(node.id)}`);
    }
    if (!node.deleted && node.content.type === 'text') {
        if (pos < node.content.text.length) {
            return [node.id, pos];
            // return [node.id[0] + pos, node.id[1]];
        }
        pos -= node.content.text.length;
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = state.map[node.children[i]];
        if (pos < child.size) {
            return posToPostLocForNode(state, child, pos);
        }
        pos -= child.size;
    }
    throw new Error(
        `Node size caches must have been miscalculated! Post pos ${pos} not found in node ${toKey(
            node.id,
        )}, even though node's size is ${node.size}`,
    );
};

// this represents the loc that is after the pos
export const posToPostLoc = (
    crdt: CRDT,
    pos: number,
): [[number, string], number] => {
    for (let i = 0; i < crdt.roots.length; i++) {
        const root = crdt.map[crdt.roots[i]];
        if (pos < root.size) {
            return posToPostLocForNode(crdt, root, pos);
        }
        pos -= root.size;
    }
    if (pos === 0) {
        return [[1, rootSite], 0];
    }
    throw new Error(`Pos ${pos} is outside the bounds`);
};

type Format = { [key: string]: any };

const countDifferences = (one, two) => {
    let differences = 0;
    Object.keys(one).forEach(key => {
        if (!deepEqual(one[key], two[key])) {
            differences += 1;
        }
    });
    Object.keys(two).forEach(key => {
        if (!(key in one)) {
            differences += 1;
        }
    });
    return differences;
};

export const adjustForFormat = (state: CRDT, loc: Loc, format: Format): Loc => {
    // if we're right next to some opens or closes, see
    // if any of the adjacent spots already have the desired
    // formatting.
    const node = nodeForKey(state, [loc.id, loc.site]);
    if (!node) {
        return loc;
    }
    if (
        node.content.type === 'text' &&
        loc.id < node.id[0] + node.content.text.length - 1
    ) {
        // we're in the middle of a text node
        return loc;
    }
    // console.log('adjusting, at the end I guess', loc, node.id);
    const nodeFormat = getFormatValues(state, node.formats);
    if (deepEqual(format, nodeFormat)) {
        return loc;
    }
    if (loc.pre) {
        const options = [
            [countDifferences(format, nodeFormat), 0, loc, nodeFormat],
        ];
        const orig = node;
        walkFrom(state, toKey(node.id), node => {
            if (node.id === orig.id) {
                return;
            }
            if (node.content.type === 'text') {
                return false;
            }
            const fmt = getFormatValues(state, node.formats);
            options.push([
                countDifferences(format, fmt),
                options.length,
                { id: node.id[0], site: node.id[1], pre: true },
                fmt,
            ]);
        });
        options.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
        // maybe I want a generator, so I can step through
        // the formatting nodes that face me?
        return options[0][2];
    } else {
        return loc; // TODO fix this
    }
    // do the nodes have formattings
};

export const formatAt = function(crdt: CRDT, pos: [number, string]): Format {
    try {
        const node = nodeForKey(crdt, pos);
        // const [id, offset] = posToPostLoc(crdt, pos);
        // const node = nodeForKey(crdt, id);
        const format = {};
        if (!node) {
            return format;
        }
        Object.keys(node.formats).forEach(key => {
            // hmm whats the point of doing it by ID? yeah there is one, its ok
            if (node.formats[key].length) {
                const fmtNode = crdt.map[node.formats[key][0]];
                if (fmtNode.content.type !== 'open') {
                    throw new Error(
                        `non-open node (${
                            node.formats[key][0]
                        }) found in a formats cache for ${toKey(node.id)}`,
                    );
                }
                format[key] = fmtNode.content.value;
            }
        });
        return format;
    } catch {
        return {};
    }
};

export const idAfter = function(crdt: CRDT, loc: Loc): number {
    const node = nodeForKey(crdt, [loc.id, loc.site]);
    if (!loc.pre) {
        return loc.id;
    }
    if (node && node.id[0] + contentLength(node.content) - 1 == loc.id) {
        if (node.children.length) {
            return crdt.map[node.children[0]].id[0];
        }
        const next = nextSibling(crdt, node);
        if (next) {
            return crdt.map[next].id[0];
        }
    }
    return 0;
};

export const posToLoc = function(
    crdt: CRDT,
    pos: number,
    // if true, loc is the char to the left of the pos (the "pre-loc")
    // if false, loc is the char to the right of the pos (the "post-loc")
    anchorToLocAtLeft: boolean,
    // Note that I don't currently support anchoring to the right
    // of the end of the string, but I probably could?
    // ok 1:root is the end, 0:root is the start. cool beans
): Loc {
    const total = length(crdt);
    if (pos > total) {
        throw new Error(`Loc ${pos} is outside of the bounds ${total}`);
    }
    const [[id, site], offset] = anchorToLocAtLeft
        ? posToPreLoc(crdt, pos)
        : posToPostLoc(crdt, pos);
    return { id: id + offset, site, pre: anchorToLocAtLeft };
};

export const nodeForKey = function(crdt: CRDT, key: [number, string]): ?Node {
    for (let i = key[0]; i >= 0; i--) {
        const k = toKey([i, key[1]]);
        if (crdt.map[k]) {
            return crdt.map[k];
        }
    }
};

export const charactersBeforeNode = function(crdt: CRDT, node: Node): number {
    let total = 0;
    while (node) {
        const siblings =
            node.parent === rootParent
                ? crdt.roots
                : crdt.map[node.parent].children;
        const idx = siblings.indexOf(node);
        if (idx === -1) {
            throw new Error(
                `node not found in parents children ${toKey(node.id)} ${
                    node.parent
                } - ${siblings.join(';')}`,
            );
        }
        for (let i = 0; i < idx; i++) {
            total += crdt.map[siblings[i]].size;
        }
        if (node.parent === rootParent) {
            break;
        } else {
            node = crdt.map[node.parent];
            if (!node.deleted && node.content.type === 'text') {
                total += node.content.text.length;
            }
        }
    }
    return total;
};

export const locToPos = function(crdt: CRDT, loc: Loc): number {
    if (loc.site === rootSite) {
        return loc.id === 0 ? 0 : length(crdt);
    }
    // step 1: find the node this loc is within
    const node = nodeForKey(crdt, [loc.id, loc.site]);
    if (!node) {
        throw new Error(`Loc does not exist in tree ${JSON.stringify(loc)}`);
    }
    // step 2: find the position-in-text for this node
    const nodePos = charactersBeforeNode(crdt, node);
    // step 3: add 1 based on whether it's pre or post
    const offset = loc.id - node.id[0];
    return nodePos + offset + (loc.pre ? 1 : 0);
};

export const locToInsertionPos = function(
    crdt: CRDT,
    after: [number, string],
    id: [number, string],
): number {
    if (after[1] === rootSite) {
        let idx = crdt.roots.length;
        let pos = 0;
        for (let i = 0; i < crdt.roots.length; i++) {
            if (keyCmp(fromKey(crdt.roots[i]), id) < 1) {
                idx = i;
                break;
            }
            pos += crdt.map[crdt.roots[i]].size;
        }
        return pos;
    }
    // step 1: find the parent node
    const node = nodeForKey(crdt, after);
    if (!node) {
        throw new Error(`Loc does not exist in tree ${JSON.stringify(after)}`);
    }

    // step 2: find the position-in-text for this node
    let nodePos = charactersBeforeNode(crdt, node);

    // We're at the end, in competition with other children
    if (node.id[0] + contentLength(node.content) === after[0] + 1) {
        nodePos += contentLength(node.content);
        let idx = node.children.length;
        for (let i = 0; i < node.children.length; i++) {
            if (keyCmp(fromKey(node.children[i]), id) < 1) {
                idx = i;
                break;
            }
            nodePos += crdt.map[node.children[i]].size;
        }
        return nodePos; // - 1;
    } else {
        // no one here but us
        const offset = after[0] - node.id[0];
        return nodePos + offset + 1;
    }
};
