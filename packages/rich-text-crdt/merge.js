// @flow
import type { Content, CRDT, Node } from './types';
import { keyCmp, toKey, contentChars } from './utils';
import { lastId } from './loc';
import { rootParent, rootSite } from './loc';

type Map = { [key: string]: Node };

class Inconsistent extends Error {}

const mergeTrees = (one: Map, two: Map, key: string) => {
    const oneNode = one[key];
    const twoNode = two[key];
    if (oneNode.content.type !== twoNode.content.type) {
        throw new Inconsistent(`Content type for node ${key}`);
    }
    // one: hellofol[m;ks]
    // two: hello[ ;folks]
    // so take the shorter of the two
    // then go to the .. children?
    // buuuut ok so the deal is:
    // go one by one ... by 'after'?
    // Ok so go through all nodes, make an 'after' map
    // then just start going through IDs
    // so we get to 'o', and we see the space
    // so we totally switch gears, right? except we need to
    // end up going back to the 'f' in case the other node doesn't
    // know about it yet.
    // Ok so the 'expensive' way is to split literally everything
    // up into characters {id, after, deleted, content}
    // and then make an after-map
    // and then go through building nodes up as we go through
};

const mergeNodes = (one: Node, two: Node) => {
    // ummmmmmm ok seems like this might be
    // dangerous right here. Like if nodes are split different,
    // it's possible I'd end up in a weird state??
    // id will be the same
    // parent - could be different due to merges
    // deleted - could be different
    // size - could be different due to new nodes
    // children - different due to new nodes, also maybe merges?
    // content - could be different due to splits / merges
    // formats - could also be different probably?
    // ummmmmm should I just go with 'make this expensive, I'll fix it later'?
    // ok how about a new plan, what if I do an O(1) walk ...
    // through both ... merging as I go along?
};

const addAtoms = (afters, node, after) => {
    const [id, site] = node.id;
    if (node.content.type === 'text') {
        const text = node.content.text;
        for (let i = 0; i < text.length; i++) {
            const thisAfter = i === 0 ? after : [id + i - 1, site];
            const key = toKey(thisAfter);
            const atom = {
                id: [id + i, site],
                deleted: node.deleted,
                content: { type: 'text', text: text.charAt(i) },
            };
            if (!afters[key]) {
                afters[key] = [atom];
            } else {
                afters[key].push(atom);
            }
        }
    } else {
        const key = toKey(after);
        const atom = {
            id: node.id,
            deleted: node.deleted,
            content: node.content,
        };
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
                }
            }
            break;
        }
    }
    node.children = collectNodes(
        map,
        afters,
        toKey(getAfter(node)),
        toKey(node.id),
    );
    node.children.forEach(child => {
        node.size += map[child].size;
    });
    map[toKey(node.id)] = node;
};

const collectNodes = (map, afters, key, parent: string): Array<string> => {
    if (!afters[key]) {
        return [];
    }
    const atoms = afters[key].sort((a, b) => keyCmp(a.id, b.id));
    const children = atoms.map(atom => {
        collectNode(map, afters, atom, parent);
        return toKey(atom.id);
    });
    return children;
};

export const merge = (one: CRDT, two: CRDT, site: string): CRDT => {
    const rootMap = {};
    one.roots.forEach(id => (rootMap[id] = true));
    two.roots.forEach(id => (rootMap[id] = true));
    let largestLocalId = 0;

    const afters = {};
    Object.keys(one.map).forEach(key => {
        const node = one.map[key];
        const after =
            node.parent === rootParent
                ? [0, rootSite]
                : getAfter(one.map[node.parent]);
        addAtoms(afters, node, after);
    });
    Object.keys(two.map).forEach(key => {
        const node = two.map[key];
        const after =
            node.parent === rootParent
                ? [0, rootSite]
                : getAfter(two.map[node.parent]);
        addAtoms(afters, node, after);
    });

    const map = {};
    const roots = collectNodes(map, afters, rootParent, rootParent);
    console.log(map);
    return {
        site,
        largestLocalId,
        roots,
        map,
    };
};
