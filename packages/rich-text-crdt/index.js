// @flow
import type { Content, CRDT, Node } from './types';
import { rootSite } from './types';

export const init = (site: string): CRDT => ({
    site,
    largestLocalId: 0,
    map: {},
    roots: [],
});

export const inflate = (
    site: string,
    roots: Array<string>,
    map: { [key: string]: Node },
) => {
    const state = {
        site,
        largestLocalId: 0,
        map,
        roots,
    };
    Object.keys(map).forEach(k => {
        const node = map[k];
        if (node.id[1] === site && node.id[0] > state.largestLocalId) {
            state.largestLocalId = node.id[0];
        }
    });
    return state;
};

export * from './deltas';
export * from './apply';
export * from './loc';
export * from './utils';
