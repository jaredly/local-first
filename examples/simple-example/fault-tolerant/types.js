// @flow
import { type ClientState, type CRDTImpl } from './client';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { CursorType } from './server.js';

export type PeerChange = { col: string, nodes: Array<string> };

export type Collection<T> = {
    save: (id: string, value: T) => Promise<void>,
    setAttribute: (
        id: string,
        path: Array<string>,
        value: any,
    ) => Promise<void>,
    load: (id: string) => Promise<?T>,
    loadAll: () => Promise<{ [key: string]: T }>,
    delete: (id: string) => Promise<void>,
    onChanges: ((Array<{ value: ?T, id: string }>) => void) => () => void,
    onItemChange: (id: string, (value: ?T) => void) => () => void,
};

// How does this line up with actual states?
export type SyncStatus =
    | {
          status: 'disconnected',
          lastSync: ?number,
          unsavedChanges: boolean,
      }
    | {
          status: 'real-time',
      }
    | {
          status: 'unsaved-changes',
          lastSync: ?number,
      }
    | {
          status: 'synced',
          lastSync: number,
      };

export type Client<SyncStatus> = {
    sessionId: string,
    getStamp(): string,
    getCollection<T>(id: string): Collection<T>,
    onSyncStatus(fn: (SyncStatus) => void): void,
    getSyncStatus(): SyncStatus,
    setDirty(): void,
};

export type makeClient = <Delta, Data>(
    persistence: Persistence<Delta, Data>,
    crdt: CRDTImpl<Delta, Data>,
    setDirty: () => void,
    initialCollections: ?Array<string>,
) => ClientState<Delta, Data>;

export type makeNetwork = <Delta, Data>(
    persistence: Persistence<Delta, Data>,
    url: string,
    crdt: CRDTImpl<Delta, Data>,
) => {
    client: ClientState<Delta, Data>,
    onConnection: ((boolean) => void) => void,
};

export type CorePersistence<Data> = {
    collections: Array<string>,
    saveHLC(hlc: HLC): void,
    getHLC(): HLC,

    get(collection: string, id: string): Promise<?Data>,
    getAll(collection: string): Promise<{ [key: string]: Data }>,
};

export type FullPersistence<Data> = {
    ...CorePersistence<Data>,
    getFull(): Promise<{ [colid: string]: { [node: string]: Data } }>,
    updateFull(
        { [colid: string]: { [node: string]: Data } },
        merge: (Data, Data) => Data,
    ): Promise<{
        [colid: string]: { [node: string]: Data },
    }>,
    update<Delta>(
        collection: string,
        deltas: Array<{ node: string, delta: Delta }>,
        apply: (data: ?Data, delta: Delta) => Data,
    ): Promise<{ [key: string]: Data }>,
};

export type Persistence<Delta, Data> = {
    ...CorePersistence<Data>,
    // saveHLC(hlc: HLC): void,
    // getHLC(): HLC,
    // get(collection: string, id: string): Promise<?Data>,
    // getAll(collection: string): Promise<{ [key: string]: Data }>,

    deltas(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    getServerCursor(collection: string): Promise<?CursorType>,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
    update(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        apply: (data: ?Data, delta: Delta) => Data,
        serverCursor: ?CursorType,
        storeDeltas: boolean,
    ): Promise<{ [key: string]: Data }>,
};
