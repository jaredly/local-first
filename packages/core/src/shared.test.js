// @flow

import { default as makeDeltaInMemoryPersistence } from './delta/delta-mem';
import { default as createDeltaClient } from './delta/create-client';
import {
    PersistentClock,
    localStorageClockPersist,
    inMemoryClockPersist,
} from './persistent-clock';
import * as crdt from '../../nested-object-crdt/src/new';
import type { CRDTImpl } from './shared';
import type { Schema } from '../../nested-object-crdt/src/schema';
import type { Client, NetworkCreator } from './types';
import { type SyncStatus } from './delta/websocket-network';

const invertOtherDelta = (base, otherDelta) => {
    console.log('cant invert rich text deltas yet', base, otherDelta);
    return null;
};

/**
 * Sooooo
 * getting serious about this whole "release to the world" bit
 * should I just buckle down and admit that there's one true crdt type?
 * that I'm actually fairly dependent on its inner workings?
 * that it doesn't really make sense to swap it out for some other type?
 *
 * well, I mean I did switch it up at one point.
 * but not in a "we can go back to this other one" kind of way, not really.
 *
 * Also, for rich text. Do I really want to let people plug & play their
 * rich text crdt setup?
 *
 * like, there are definitely pros & cons
 * and I do want to be able to tweak it.
 *
 * but pretending this type is "other" is a bit off. it's definitely rich text.
 *
 * So, how do I begin to concretize?
 *
 * Because, I could probably genericize again later if I wanted.
 *
 * Anyway, I'd say we first test a ton of things. Yes please.
 *
 * So basically, several things in client-bundle will come into /core
 * and several things in /core will drop their type arguments.
 *
 */

// const otherMerge = (v1, m1, v2, m2) => {
//     // return { value: rich.merge(v1, v2), meta: null };
// };
// const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
//     return {
//         value: rich.apply(text, delta),
//         meta,
//     };
// };

type Data = crdt.CRDT<any, any>;
type Delta = crdt.Delta<any, any, null>;

const clientCrdtImpl: CRDTImpl<Delta, Data> = {
    merge: (one: ?Data, two: Data): Data => {
        if (!one) return two;
        return crdt.mergeTwo(one, two, (v1, _, v2, __) => ({ value: null, meta: null }));
    },
    latestStamp: data => crdt.latestStamp(data, () => null),
    value: d => d.value,
    get: crdt.get,
    createEmpty: stamp => crdt.createEmpty(stamp),
    deltas: {
        ...crdt.deltas,
        invert: (base, delta, getStamp) => crdt.invert(base, delta, getStamp, invertOtherDelta),
        stamp: data => crdt.deltas.stamp(data, () => null),
        restamp: (delta: Delta, stamp: string) => crdt.restamp(delta, stamp),
        apply: (base, delta) =>
            crdt.applyDelta(
                base,
                delta,
                (_, __, ___) => ({ meta: null, value: null }: any),
                (v1, _, v2, __) => ({ value: null, meta: null }),
            ),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return crdt.createWithSchema(value, stamp, getStamp, schema, value => null);
    },
};

const nullNetwork: NetworkCreator<any, any, any> = (_, __, ___) => ({
    initial: { status: 'disconnected' },
    createSync: (_, __, ___) => () => {},
    close() {},
});

const createInMemoryEphemeralClient = (
    schemas: {
        [key: string]: Schema,
    },
    network: ?NetworkCreator<*, *, *> = null,
): Client<SyncStatus> => {
    return createDeltaClient(
        'in-memory',
        clientCrdtImpl,
        schemas,
        new PersistentClock(inMemoryClockPersist()),
        makeDeltaInMemoryPersistence(Object.keys(schemas)),
        network ? network : nullNetwork,
    );
};

describe('getCollection', () => {
    it('is a series of tubes I think', () => {
        // yes please.
    });
});
