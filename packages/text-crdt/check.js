// @flow
import type { Node, CRDT } from './types';
import { toKey, keyCmp, length } from './utils';
import { locToPos, posToLoc } from './loc';
import deepEqual from '@birchill/json-equalish';

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
    if (!deepEqual(copy, ids)) {
        throw new Error(
            `Children out of order: ${ids.join(',')} vs ${copy.join(',')}`,
        );
    }
};

export const checkConsistency = (state: CRDT<any>) => {
    state.roots.forEach(checkNode);
    const len = length(state);
    for (let i = 0; i < len; i++) {
        const m = posToLoc(state, i, true);
        if (!m) {
            throw new Error(`No parent loc for cursor ${i}`);
        }
        const back = locToPos(state, m);
        if (back !== i) {
            throw new Error(
                `To loc and back again failed; orig ${i} loc ${JSON.stringify(
                    m,
                )} result ${back}`,
            );
        }
    }
};
