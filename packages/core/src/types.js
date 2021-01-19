// @flow
import type { HLC } from '../../hybrid-logical-clock';
import { type ClientMessage, type ServerMessage } from './server';
import { type Schema } from '../../nested-object-crdt/src/schema';

export type CursorType = number;
export type PeerChange = { col: string, nodes: Array<string> };

export type OldNetwork<SyncStatus> = {
    onSyncStatus(fn: (SyncStatus) => void): void,
    getSyncStatus(): SyncStatus,
    sendCrossTabChanges(PeerChange): void,
    setDirty: () => void,
    close: () => void,
};

export type Export<Data> = { [colId: string]: { [nodeId: string]: Data } };

export type Client<SyncStatus> = {
    sessionId: string,
    getStamp(): string,
    undo(): void,
    fullExport<Data>(): Promise<Export<Data>>,
    importDump<Data>(data: Export<Data>): Promise<void>,
    getCollection<T>(id: string): Collection<T>,
    onSyncStatus(fn: (SyncStatus) => void): void,
    getSyncStatus(): SyncStatus,
    setDirty(): void,
    teardown(): Promise<void>,
    close(): void,
};

export type Collection<T> = {
    save: (id: string, value: T) => Promise<void>,
    insertId: (id: string, path: Array<string | number>, idx: number, id: string) => Promise<void>,
    insertIdRelative: (
        id: string,
        path: Array<string | number>,
        childId: string,
        relativeTo: string,
        before: boolean,
    ) => Promise<void>,
    removeId: (id: string, path: Array<string | number>, id: string) => Promise<void>,
    reorderIdRelative: (
        id: string,
        path: Array<string | number>,
        childId: string,
        relativeTo: string,
        before: boolean,
    ) => Promise<void>,

    clearAttribute: (id: string, path: Array<string | number>) => Promise<void>,
    setAttribute: (id: string, path: Array<string | number>, value: any) => Promise<void>,
    applyRichTextDelta<OtherDelta>(
        id: string,
        path: Array<string | number>,
        deltas: Array<OtherDelta>,
    ): Promise<void>,
    getCached: (id: string) => ?T,
    genId: () => string,
    load: (id: string) => Promise<?T>,
    loadAll: () => Promise<{ [key: string]: T }>,
    delete: (id: string) => Promise<void>,
    onChanges: ((Array<{ value: ?T, id: string }>) => void) => () => void,
    onItemChange: (id: string, (value: ?T) => void) => () => void,
};

export type QueryOp = '=' | '>=' | '<=' | '>' | '<';

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
        apply: (Data, Delta) => Data,
    ): Promise<Data>,
    fullExport<Data>(): Promise<Export<Data>>,
    load<T>(colid: string, id: string): Promise<?T>,
    loadAll<T>(colid: string): Promise<{ [key: string]: T }>,
    query<T>(
        colid: string,
        key: string,
        op: QueryOp,
        value: any,
    ): Promise<Array<{ key: string, value: T }>>,
    tabIsolated: boolean,
    teardown(): Promise<void>,
    // delete(colid: string, id: string): Promise<void>,
};

export type MultiPersistence = {
    ...Persistence,
    getFull<Data>(
        serverId: string,
    ): Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeFull<Delta, Data>(
        serverId: string,
        full: Blob<Data>,
        etag: string,
        merge: (Data, Data) => Data,
        diff: (one: ?Data, two: Data) => Delta,
        ts: () => string,
    ): Promise<?{
        merged: { blob: Blob<Data>, stamp: ?string },
        changedIds: { [colid: string]: Array<string> },
    }>,
    updateMeta: (
        serverId: string,
        serverEtag: ?string,
        dirtyStampToClear: ?string,
    ) => Promise<void>,

    applyDeltas<Delta, Data>(
        colid: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        serverCursor: ?number,
        apply: (Data, Delta) => Data,
    ): Promise<{ [key: string]: Data }>,
    deltas<Delta>(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    getServerCursor(collection: string): Promise<?number>,
    deleteDeltas(collection: string, upTo: string): Promise<void>,
};

export type FullPersistence = {
    ...Persistence,
    getFull<Data>(): Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeFull<Data>(
        full: Blob<Data>,
        etag: ?string,
        merge: (Data, Data) => Data,
    ): Promise<?{
        merged: { blob: Blob<Data>, stamp: ?string },
        changedIds: { [colid: string]: Array<string> },
    }>,
    updateMeta: (serverEtag: ?string, dirtyStampToClear: ?string) => Promise<void>,
};

export type DeltaPersistence = {
    ...Persistence,
    // this doesn't save deltas locally, because they came from remote-land
    applyDeltas<Delta, Data>(
        colid: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        serverCursor: ?CursorType,
        apply: (Data, Delta) => Data,
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

export type PersistentClock = {
    get(): string,
    set(newClock: HLC): void,
    recv(newClock: HLC): void,
    teardown(): void,
    now: HLC,
};

export type Blob<Data> = {
    [colid: string]: {
        [id: string]: Data,
    },
};

export type Network<SyncStatus> = {
    initial: SyncStatus,
    createSync: (
        sendCrossTabChange: (PeerChange) => void,
        (SyncStatus) => void,
        softResync: () => void,
    ) => (softResync: boolean) => void,
    close: () => void,
};

export type BlobNetworkCreator<Data, SyncStatus> = (
    getLocal: () => Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeIntoLocal: (
        remote: Blob<Data>,
        etag: string,
        (PeerChange) => mixed,
    ) => Promise<?{ blob: Blob<Data>, stamp: ?string }>,
    updateMeta: (newServerEtag: ?string, dirtyFlagToClear: ?string) => Promise<void>,
) => Network<SyncStatus>;

export type NetworkCreator<Delta, Data, SyncStatus> = (
    sessionId: string,
    getMessages: (fresh: boolean) => Promise<Array<ClientMessage<Delta, Data>>>,
    handleMessages: (
        Array<ServerMessage<Delta, Data>>,
        (PeerChange) => mixed,
    ) => Promise<Array<ClientMessage<Delta, Data>>>,
) => Network<SyncStatus>;
