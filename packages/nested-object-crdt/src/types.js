// @flow

export type { Sort } from './array-utils';
import type { Sort } from './array-utils';

export type KeyPath = Array<{ stamp: string, key: string }>;

export type ArrayMeta<Other> = {|
    type: 'array',
    items: {
        [key: string]: {
            sort: { stamp: string, idx: Sort },
            meta: Meta<Other>,
        },
    },
    // This is just a cache
    idsInOrder: Array<string>,
    hlcStamp: string,
|};

export type MapMeta<Other> = {|
    type: 'map',
    map: { [key: string]: Meta<Other> },
    hlcStamp: string,
|};

export type OtherMeta<Other> = {|
    type: 'other',
    meta: Other,
    hlcStamp: string,
|};

export type PlainMeta = {|
    type: 'plain',
    hlcStamp: string,
|};

export type TombstoneMeta = {|
    type: 't',
    hlcStamp: string,
|};

export type HostDelta<T, Other> =
    | {|
          type: 'set',
          path: KeyPath,
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'insert',
          path: KeyPath,
          // The last ID is the ID to add here folks
          sort: { idx: Sort, stamp: string },
          value: CRDT<T, Other>,
      |}
    | {|
          type: 'reorder',
          path: KeyPath,
          sort: { idx: Sort, stamp: string },
      |};

export type Delta<T, Other, OtherDelta> =
    | HostDelta<T, Other>
    | {
          type: 'other',
          path: KeyPath,
          delta: OtherDelta,
      };

export type Meta<Other> =
    | MapMeta<Other>
    | PlainMeta
    | TombstoneMeta
    | OtherMeta<Other>
    | ArrayMeta<Other>;

export type CRDT<T, Other> = {|
    value: T,
    meta: Meta<Other>,
|};

export type OtherMerge<Other> = (
    v1: any,
    m1: Other,
    v2: any,
    m2: Other,
) => { value: any, meta: Other };
