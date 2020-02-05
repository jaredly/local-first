// @flow
import type { HLC } from '@local-first/hybrid-logical-clock';
import { type PeerChange } from '../client';
import { type ClientMessage, type ServerMessage } from '../server';

export type Network<SyncStatus> = {
    onSyncStatus(fn: (SyncStatus) => void): void,
    getSyncStatus(): SyncStatus,
    sendCrossTabChanges(PeerChange): void,
    setDirty: () => void,
};

// does persistence encapsulate the crdt?
// umm maybe?
// or we pass in the crdt with each call? yep

// Ok, so this is the min required for the `getCollection` thing to work, I believe.
export type Persistence = {
    collections: Array<string>,
    // save<T>(colid: string, id: string, node: T): Promise<void>,
    // this saves local
    applyDelta<Delta, Data>(
        colid: string,
        id: string,
        delta: Delta,
        stamp: string,
        apply: (?Data, Delta) => Data,
    ): Promise<Data>,
    load<T>(colid: string, id: string): Promise<?T>,
    loadAll<T>(colid: string): Promise<{ [key: string]: T }>,
    // delete(colid: string, id: string): Promise<void>,
};

export type FullPersistence = {
    ...Persistence,
    getFull<Data>(): Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeFull<Data>(
        full: Blob<Data>,
        etag: string,
        merge: (Data, Data) => Data,
    ): Promise<{ blob: Blob<Data>, stamp: ?string }>,
    updateMeta: (
        serverEtag: ?string,
        dirtyStampToClear: ?string,
    ) => Promise<void>,
};

export type DeltaPersistence = {
    ...Persistence,
    // this doesn't save deltas locally, because they came from remote-land
    applyDeltas<Delta, Data>(
        colid: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        serverCursor: number,
        apply: (?Data, Delta) => Data,
    ): Promise<{ [key: string]: Data }>,
    deltas<Delta>(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    getServerCursor(collection: string): Promise<?number>,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
};

export type ClockPersist = {
    get(init: () => HLC): HLC,
    set(HLC): void,
};

export type Blob<Data> = {
    [colid: string]: {
        [id: string]: Data,
    },
};

export type BlobNetworkCreator<Data, SyncStatus> = (
    getLocal: () => Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeIntoLocal: (
        remote: Blob<Data>,
        etag: string,
    ) => Promise<{ blob: Blob<Data>, stamp: ?string }>,
    updateMeta: (
        newServerEtag: ?string,
        dirtyFlagToClear: ?string,
    ) => Promise<void>,
    handleCrossTabChanges: (PeerChange) => Promise<void>,
) => Network<SyncStatus>;

export type NetworkCreator<Delta, Data, SyncStatus> = (
    sessionId: string,
    getMessages: (fresh: boolean) => Promise<Array<ClientMessage<Delta, Data>>>,
    handleMessages: (
        Array<ServerMessage<Delta, Data>>,
        (PeerChange) => mixed,
    ) => Promise<void>,
    handleCrossTabChanges: (PeerChange) => Promise<void>,
) => Network<SyncStatus>;
