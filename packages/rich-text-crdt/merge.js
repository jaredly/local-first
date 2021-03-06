// @flow
import type { Content, CRDT, Node, FormatContent } from './types';
import { keyCmp, toKey, contentChars } from './utils';
import { lastId, walk, fmtIdx, rootParent, rootSite } from './loc';

type Map = { [key: string]: Node };

class Inconsistent extends Error {}

// const mergeTrees = (one: Map, two: Map, key: string) => {
//     const oneNode = one[key];
//     const twoNode = two[key];
//     if (oneNode.content.type !== twoNode.content.type) {
//         throw new Inconsistent(`Content type for node ${key}`);
//     }
//     // one: hellofol[m;ks]
//     // two: hello[ ;folks]
//     // so take the shorter of the two
//     // then go to the .. children?
//     // buuuut ok so the deal is:
//     // go one by one ... by 'after'?
//     // Ok so go through all nodes, make an 'after' map
//     // then just start going through IDs
//     // so we get to 'o', and we see the space
//     // so we totally switch gears, right? except we need to
//     // end up going back to the 'f' in case the other node doesn't
//     // know about it yet.
//     // Ok so the 'expensive' way is to split literally everything
//     // up into characters {id, after, deleted, content}
//     // and then make an after-map
//     // and then go through building nodes up as we go through
// };

// const mergeNodes = (one: Node, two: Node) => {
//     // ummmmmmm ok seems like this might be
//     // dangerous right here. Like if nodes are split different,
//     // it's possible I'd end up in a weird state??
//     // id will be the same
//     // parent - could be different due to merges
//     // deleted - could be different
//     // size - could be different due to new nodes
//     // children - different due to new nodes, also maybe merges?
//     // content - could be different due to splits / merges
//     // formats - could also be different probably?
//     // ummmmmm should I just go with 'make this expensive, I'll fix it later'?
//     // ok how about a new plan, what if I do an O(1) walk ...
//     // through both ... merging as I go along?
// };

const addAtoms = (atoms, afters, node, after) => {
    const [id, site] = node.id;
    if (node.content.type === 'text') {
        const text = node.content.text;
        for (let i = 0; i < text.length; i++) {
            const thisAfter = i === 0 ? after : [id + i - 1, site];
            const key = toKey(thisAfter);
            const atomKey = toKey([id + i, site]);
            if (atoms[atomKey]) {
                if (node.deleted && !atoms[atomKey].deleted) {
                    atoms[atomKey].deleted = true;
                }
                continue;
            }
            const atom = {
                id: [id + i, site],
                deleted: node.deleted,
                content: { type: 'text', text: text.charAt(i) },
            };
            atoms[atomKey] = atom;
            if (!afters[key]) {
                afters[key] = [atom];
            } else {
                afters[key].push(atom);
            }
        }
    } else {
        const key = toKey(after);
        const atomKey = toKey(node.id);
        if (atoms[atomKey]) {
            if (node.deleted && !atoms[atomKey].deleted) {
                atoms[atomKey].deleted = true;
            }
            return;
        }
        const atom = {
            id: node.id,
            deleted: node.deleted,
            content: node.content,
        };
        atoms[atomKey] = atom;
        if (!afters[key]) {
            afters[key] = [atom];
        } else {
            afters[key].push(atom);
        }
    }
};

const getAfter = node => lastId(node);

const collectNode = (map, afters, atom, parent: string) => {
    const node: Node = {
        id: atom.id,
        parent,
        size: atom.deleted ? 0 : contentChars(atom.content),
        children: [],
        content: atom.content,
        formats: {},
    };
    if (atom.deleted) {
        node.deleted = true;
    }
    if (atom.content.type === 'text') {
        const content = atom.content;
        for (let i = 0; ; i++) {
            const key = toKey([node.id[0] + i, node.id[1]]);
            if (afters[key] && afters[key].length === 1) {
                const child = afters[key][0];
                if (
                    child.id[1] === node.id[1] &&
                    child.id[0] === node.id[0] + i + 1 &&
                    child.content.type === 'text' &&
                    child.deleted === node.deleted
                ) {
                    // mutation!! this is ok b/c atoms are single-use
                    content.text += child.content.text;
                    if (!node.deleted) {
                        node.size += 1;
                    }
                    continue;
                }
            }
            break;
        }
    }
    node.children = collectNodes(map, afters, toKey(getAfter(node)), toKey(node.id));
    node.children.forEach(child => {
        node.size += map[child].size;
    });
    map[toKey(node.id)] = node;
};

const collectNodes = (map, afters, key, parent: string): Array<string> => {
    if (!afters[key]) {
        return [];
    }
    const atoms = afters[key].sort((a, b) => -keyCmp(a.id, b.id));
    const children = atoms.map(atom => {
        collectNode(map, afters, atom, parent);
        return toKey(atom.id);
    });
    return children;
};

const addFormats = (state: CRDT) => {
    let format = {};
    walk(state, node => {
        if (node.content.type === 'open') {
            const { content } = node;
            const current = format[content.key] ? format[content.key].slice() : [];
            const idx = fmtIdx(
                current.map(id => ((state.map[id].content: any): FormatContent)),
                content,
            );
            current.splice(idx, 0, toKey(node.id));
            format = { ...format, [content.key]: current };
        }
        if (node.content.type === 'close' && format[node.content.key]) {
            const { content } = node;
            const current = format[content.key].filter(
                id =>
                    state.map[id].content.type !== 'text' &&
                    state.map[id].content.stamp !== content.stamp,
            );
            if (!current.length) {
                format = { ...format };
                delete format[content.key];
            } else {
                format = { ...format, [content.key]: current };
            }
        }
        node.formats = format;
    });
};

export const merge = (one: CRDT, two: CRDT): CRDT => {
    const rootMap = {};
    one.roots.forEach(id => (rootMap[id] = true));
    two.roots.forEach(id => (rootMap[id] = true));
    const largestIDs = { ...one.largestIDs };
    // console.warn('Merge largestIDs', one.largestIDs, two.largestIDs);
    Object.keys(two.largestIDs).forEach(site => {
        largestIDs[site] = Math.max(largestIDs[site] || 0, two.largestIDs[site]);
    });

    const atoms = {};
    const afters = {};
    Object.keys(one.map).forEach(key => {
        const node = one.map[key];
        const after = node.parent === rootParent ? [0, rootSite] : getAfter(one.map[node.parent]);
        addAtoms(atoms, afters, node, after);
        // if (node.id[1] === site) {
        //     largestLocalId = Math.max(largestLocalId, lastId(node)[0]);
        // }
    });
    Object.keys(two.map).forEach(key => {
        const node = two.map[key];
        const after = node.parent === rootParent ? [0, rootSite] : getAfter(two.map[node.parent]);
        addAtoms(atoms, afters, node, after);
        // if (node.id[1] === site) {
        //     largestLocalId = Math.max(largestLocalId, lastId(node)[0]);
        // }
    });

    const map = {};
    const roots = collectNodes(map, afters, rootParent, rootParent);
    // console.log(map);
    const res = {
        largestIDs,
        roots,
        map,
    };
    addFormats(res);
    return res;
};
