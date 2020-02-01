// @flow
import type { HLC } from '@local-first/hybrid-logical-clock';

export type Network<SyncStatus> = {
    onSyncStatus(fn: (SyncStatus) => void): void,
};

// does persistence encapsulate the crdt?
// umm maybe?
// or we pass in the crdt with each call?
export type Persistence = {
    collections: Array<string>,
    save<T>(colid: string, id: string, node: T): Promise<void>,
    applyDelta<Delta, Data>(
        colid: string,
        id: string,
        delta: Delta,
        apply: (?Data, Delta) => Data,
    ): Promise<Data>,
    load<T>(colid: string, id: string): Promise<?T>,
    loadAll<T>(colid: string): Promise<{ [key: string]: T }>,
    // delete(colid: string, id: string): Promise<void>,
};

export type ClockPersist = {
    get(init: () => HLC): HLC,
    set(HLC): void,
};
