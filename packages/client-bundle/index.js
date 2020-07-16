// @flow
// import 'regenerator-runtime/runtime';
import * as hlc from '../hybrid-logical-clock';
export type { HLC } from '../hybrid-logical-clock';
import * as crdt from '../nested-object-crdt/src/new';
export type { Delta, CRDT as Data } from '../nested-object-crdt/src/types';
import * as rich from '../rich-text-crdt';
import type { Schema } from '../nested-object-crdt/src/schema';
export { validateDelta, validate, subSchema } from '../nested-object-crdt/src/schema';
export { hlc, crdt, rich };
export type { Schema };

import type { CRDTImpl } from '../core/src/shared';
import type { Client, NetworkCreator } from '../core/src/types';
export type { Client, Collection } from '../core/src/types';

import { default as createBlobClient } from '../core/src/blob/create-client';
import { default as makeBlobPersistence } from '../idb/src/blob';
import {
    default as createBasicBlobNetwork,
    type SyncStatus as BlobSyncStatus,
} from '../core/src/blob/basic-network';

export { default as createBlobClient } from '../core/src/blob/create-client';
export { default as makeBlobPersistence } from '../idb/src/blob';
export { default as createBasicBlobNetwork } from '../core/src/blob/basic-network';

import { default as createDeltaClient } from '../core/src/delta/create-client';
import { default as makeDeltaPersistence, type IndexConfig } from '../idb/src/delta';
import {
    default as createPollingNetwork,
    type SyncStatus as PollingSyncStatus,
} from '../core/src/delta/polling-network';
import {
    default as createWebSocketNetwork,
    type SyncStatus,
} from '../core/src/delta/websocket-network';
import { default as makeDeltaInMemoryPersistence } from '../idb/src/delta-mem';

export { default as makeDeltaInMemoryPersistence } from '../idb/src/delta-mem';
export { default as createDeltaClient } from '../core/src/delta/create-client';
export { default as makeDeltaPersistence } from '../idb/src/delta';
export { default as createPollingNetwork } from '../core/src/delta/polling-network';
export { default as createWebSocketNetwork, SyncStatus } from '../core/src/delta/websocket-network';

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

const invertOtherDelta = (base, otherDelta) => {
    console.log('cant invert rich text deltas yet', base, otherDelta);
    return null;
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
        invert: (base, delta, getStamp) => crdt.invert(base, delta, getStamp, invertOtherDelta),
        stamp: data => crdt.deltas.stamp(data, () => null),
        restamp: (delta: Delta, stamp: string) => crdt.restamp(delta, stamp),
        apply: (base, delta) => crdt.applyDelta(base, delta, (applyOtherDelta: any), otherMerge),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return crdt.createWithSchema(value, stamp, getStamp, schema, value => null);
    },
};

const nullNetwork: NetworkCreator<any, any, any> = (_, __, ___) => ({
    initial: { status: 'disconnected' },
    createSync: (_, __, ___) => () => {},
});

const blobNullNetwork = (_, __, ___) => ({
    initial: { status: 'disconnected' },
    createSync: (_, __, ___) => () => {},
});

export const createPersistedBlobClient = (
    name: string,
    schemas: { [key: string]: Schema },
    url: ?string,
    version: number,
): Client<BlobSyncStatus> => {
    return createBlobClient<Delta, Data, BlobSyncStatus>(
        name,
        clientCrdtImpl,
        schemas,
        new PersistentClock(localStorageClockPersist(name)),
        makeBlobPersistence(name, Object.keys(schemas), version),
        url != null ? createBasicBlobNetwork<Delta, Data>(url) : blobNullNetwork,
    );
};

export const createPersistedDeltaClient = (
    name: string,
    schemas: { [colid: string]: Schema },
    url: ?string,
    version: number,
    indexes: { [colid: string]: { [indexId: string]: IndexConfig } },
): Client<SyncStatus> => {
    return createDeltaClient<*, *, SyncStatus>(
        name,
        clientCrdtImpl,
        schemas,
        new PersistentClock(localStorageClockPersist(name)),
        makeDeltaPersistence(name, Object.keys(schemas), version, indexes),
        url != null ? createWebSocketNetwork(url) : nullNetwork,
    );
};

export const createPollingPersistedDeltaClient = (
    name: string,
    schemas: { [colid: string]: Schema },
    url: ?string,
    version: number,
    indexes: { [colid: string]: { [indexId: string]: IndexConfig } },
): Client<PollingSyncStatus> => {
    return createDeltaClient<*, *, PollingSyncStatus>(
        name,
        clientCrdtImpl,
        schemas,
        new PersistentClock(localStorageClockPersist(name)),
        makeDeltaPersistence(name, Object.keys(schemas), version, indexes),
        url != null ? createPollingNetwork(url) : nullNetwork,
    );
};

export const createInMemoryDeltaClient = (
    schemas: { [key: string]: Schema },
    url: string,
): Client<SyncStatus> => {
    return createDeltaClient(
        'in-memory',
        clientCrdtImpl,
        schemas,
        new PersistentClock(inMemoryClockPersist()),
        makeDeltaInMemoryPersistence(Object.keys(schemas)),
        createWebSocketNetwork(url),
    );
};
