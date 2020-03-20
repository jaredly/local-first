// @flow

import * as sortedArray from './array-utils';
import type {
    CRDT,
    Meta,
    Sort,
    KeyPath,
    Delta,
    HostDelta,
    ArrayMeta,
    PlainMeta,
    MapMeta,
    OtherMerge,
} from './types';

export const value = function<T, Other>(crdt: CRDT<T, Other>): T {
    return crdt.value;
};
