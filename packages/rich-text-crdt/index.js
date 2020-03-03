// @flow
import type { Content, CRDT, Node } from './types';
import { rootSite } from './types';

export const init = (site: string): CRDT => ({
    site,
    largestLocalId: 0,
    map: {},
    roots: [],
});

export * from './deltas';
export * from './apply';
