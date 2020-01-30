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

export type Persistence<Delta, Data> = {
    saveHLC(hlc: HLC): void,
    getHLC(): HLC,
    deltas(
        collection: string,
    ): Promise<Array<{ node: string, delta: Delta, stamp: string }>>,
    addDeltas(
        collection: string,
        deltas: Array<{ node: string, delta: Delta, stamp: string }>,
    ): Promise<void>,
    getServerCursor(collection: string): Promise<?CursorType>,

    deleteDeltas(collection: string, upTo: string): Promise<void>,
    get<T>(collection: string, id: string): Promise<?T>,
    changeMany<T>(
        collection: string,
        ids: Array<string>,
        process: ({ [key: string]: T }) => void,
        serverCursor: ?CursorType,
    ): Promise<{ [key: string]: T }>,
    getAll<T>(collection: string): Promise<{ [key: string]: T }>,
};
