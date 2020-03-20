// @flow

import type { CRDT } from './types';
export * from './create';
export * from './types';
export * from './utils';
export * from './apply';
export * from './deltas';

export const value = function<T, Other>(crdt: CRDT<T, Other>): T {
    return crdt.value;
};
