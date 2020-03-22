// @flow
import type { Content, CRDT, Node } from './types';
import { lastId, keyCmp, toKey } from './utils';
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

const addAtoms = (atoms, node, after) => {
    const [id, site] = node.id;
    if (node.content.type === 'text') {
        const text = node.content.text;
        for (let i = 0; i < text.length; i++) {
            const key = toKey([id + i, site]);
            atoms[key] = {
                id: [id + i, site],
                after: i === 0 ? after : [id + i - 1, site],
                content: { type: 'text', text: text.charAt(i) },
            };
        }
    } else {
        const key = toKey(node.id);
        atoms[key] = {
            id: node.id,
            after,
            content: node.content,
        };
    }
};

const getAfter = node => [lastId(node), node.id[1]];

const collectNodes = (map, atoms, key) => {
    if (!atoms[key]) {
        throw new Error(`Missing atom ${key}`);
    }
    const atom = atoms[key];
};

export const merge = (one: CRDT, two: CRDT, site: string): CRDT => {
    const rootMap = {};
    one.roots.forEach(id => (rootMap[id] = true));
    two.roots.forEach(id => (rootMap[id] = true));
    let largestLocalId = 0;
    const roots = Object.keys(rootMap);

    const atoms = {};
    Object.keys(one.map).forEach(key => {
        const node = one.map[key];
        const after =
            node.parent === rootParent
                ? [0, rootSite]
                : getAfter(one.map[node.parent]);
        addAtoms(atoms, node);
    });

    const map = {};
    roots.forEach(key => collectNodes(map, atoms, key));
    // const map = { ...one.map };
    // Object.keys(one.map).forEach(key => {
    //     if (one.map[key].id[1] === site) {
    //         largestLocalId = Math.max(lastId(one.map[key]), largestLocalId);
    //     }
    // });
    // Object.keys(two.map).forEach(id => {
    //     if (map[id]) {
    //         map[id] = mergeNodes(map[id], two[id]);
    //     } else {
    //         if (two.map[id].id[1] === site) {
    //             largestLocalId = Math.max(lastId(two.map[id]), largestLocalId);
    //         }
    //         map[id] = two.map[id];
    //     }
    // });

    roots.sort((a, b) => keyCmp(map[a].id, map[b].id));
    return {
        site,
        largestLocalId,
        roots,
        map,
    };
};
