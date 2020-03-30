// @flow
// import 'regenerator-runtime/runtime';
import * as hlc from '../hybrid-logical-clock';
export type { HLC } from '../hybrid-logical-clock';
import * as crdt from '../nested-object-crdt/src/new';
export type { Delta, CRDT as Data } from '../nested-object-crdt/src/types';
import * as rich from '../rich-text-crdt';
import type { Schema } from '../nested-object-crdt/src/schema';
export { hlc, crdt, rich };
export type { Schema };

import type { CRDTImpl } from '../core/src/shared';
import type { Client } from '../core/src/types';
export type { Client, Collection } from '../core/src/types';

import { default as createBlobClient } from '../core/src/blob/create-client';
import { default as makeBlobPersistence } from '../idb/src/blob';
import { default as createBasicBlobNetwork } from '../core/src/blob/basic-network';

export { default as createBlobClient } from '../core/src/blob/create-client';
export { default as makeBlobPersistence } from '../idb/src/blob';
export { default as createBasicBlobNetwork } from '../core/src/blob/basic-network';

import { default as createDeltaClient } from '../core/src/delta/create-client';
import { default as makeDeltaPersistence } from '../idb/src/delta';
import { default as createPollingNetwork } from '../core/src/delta/polling-network';
import {
    default as createWebSocketNetwork,
    type SyncStatus,
} from '../core/src/delta/websocket-network';
import { default as makeDeltaInMemoryPersistence } from '../idb/src/delta-mem';

export { default as makeDeltaInMemoryPersistence } from '../idb/src/delta-mem';
export { default as createDeltaClient } from '../core/src/delta/create-client';
export { default as makeDeltaPersistence } from '../idb/src/delta';
export { default as createPollingNetwork } from '../core/src/delta/polling-network';
export {
    default as createWebSocketNetwork,
    SyncStatus,
} from '../core/src/delta/websocket-network';

export {
    PersistentClock,
    localStorageClockPersist,
    inMemoryClockPersist,
} from '../core/src/persistent-clock';

import {
    PersistentClock,
    localStorageClockPersist,
    inMemoryClockPersist,
} from '../core/src/persistent-clock';

type Data = crdt.CRDT<any, any>;
type Delta = crdt.Delta<any, any, rich.Delta>;

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

export const clientCrdtImpl: CRDTImpl<Delta, Data> = {
    merge: (one: ?Data, two: Data): Data => {
        if (!one) return two;
        return crdt.mergeTwo(one, two, (v1, _, v2, __) => ({
            value: rich.merge(v1, v2),
            meta: null,
        }));
    },
    latestStamp: data => crdt.latestStamp(data, () => null),
    value: d => d.value,
    get: crdt.get,
    createEmpty: stamp => crdt.createEmpty(stamp),
    deltas: {
        ...crdt.deltas,
        stamp: data => crdt.deltas.stamp(data, () => null),
        apply: (base, delta) =>
            crdt.applyDelta(base, delta, (applyOtherDelta: any), otherMerge),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return crdt.createWithSchema(
            value,
            stamp,
            getStamp,
            schema,
            value => null,
        );
    },
};

const nullNetwork = (_, __, ___) => ({
    initial: { status: 'disconnected' },
    createSync: (_, __, ___) => () => {},
});

export const createPersistedBlobClient = (
    name: string,
    schemas: { [key: string]: Schema },
    url: ?string,
    version: number,
): Client<SyncStatus> => {
    return createBlobClient(
        clientCrdtImpl,
        schemas,
        new PersistentClock(localStorageClockPersist(name)),
        makeBlobPersistence(name, Object.keys(schemas), version),
        url ? createBasicBlobNetwork(url) : nullNetwork,
    );
};

export const createPersistedDeltaClient = (
    name: string,
    schemas: { [key: string]: Schema },
    url: ?string,
): Client<SyncStatus> => {
    return createDeltaClient(
        clientCrdtImpl,
        schemas,
        new PersistentClock(localStorageClockPersist(name)),
        makeDeltaPersistence(name, Object.keys(schemas)),
        url ? createWebSocketNetwork(url) : nullNetwork,
    );
};

export const createInMemoryDeltaClient = (
    schemas: { [key: string]: Schema },
    url: string,
): Client<SyncStatus> => {
    return createDeltaClient(
        clientCrdtImpl,
        schemas,
        new PersistentClock(inMemoryClockPersist()),
        makeDeltaInMemoryPersistence(Object.keys(schemas)),
        createWebSocketNetwork(url),
    );
};
