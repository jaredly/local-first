// @flow
import { type ClientState, type CRDTImpl } from './client';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { CursorType } from './server.js';

export type PeerChange = { col: string, nodes: Array<string> };

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
    saveHLC(hlc: HLC): void,
    getHLC(): HLC,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
    get(collection: string, id: string): Promise<?Data>,
    update<Delta>(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        apply: (data: ?Data, delta: Delta) => Data,
    ): Promise<{ [key: string]: Data }>,
    getAll(collection: string): Promise<{ [key: string]: Data }>,
};

export type FullPersistence<Data> = {
    ...CorePersistence<Data>,
    getFull(
        Array<string>,
    ): Promise<{ [colid: string]: { [node: string]: Data } }>,
    updateFull({ [colid: string]: { [node: string]: Data } }): Promise<void>,
};

export type Persistence<Delta, Data> = {
    saveHLC(hlc: HLC): void,
    getHLC(): HLC,
    deltas(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    getServerCursor(collection: string): Promise<?CursorType>,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
    get(collection: string, id: string): Promise<?Data>,
    update(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        apply: (data: ?Data, delta: Delta) => Data,
        serverCursor: ?CursorType,
        storeDeltas: boolean,
    ): Promise<{ [key: string]: Data }>,
    getAll(collection: string): Promise<{ [key: string]: Data }>,
};
