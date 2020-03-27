// @flow
import type { Content, CRDT, Node } from './types';

export const init = (): CRDT => ({
    largestIDs: {},
    map: {},
    roots: [],
});

export * from './merge';
export * from './deltas';
export * from './apply';
export * from './loc';
export * from './utils';
export * from './types';
