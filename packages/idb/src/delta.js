// @flow
import { openDB } from 'idb';
import * as hlc from '../../hybrid-logical-clock';
import type { HLC } from '../../hybrid-logical-clock';
import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import { type CursorType } from '../../../packages/core/src/types';
import deepEqual from 'fast-deep-equal';
import type { Persistence, FullPersistence, DeltaPersistence, Export } from '../../core/src/types';
import type { DB, Transaction } from './types';

export const applyDeltas = async function<Delta, Data>(
    db: Promise<DB>,
    collection: string,
    deltas: Array<{ node: string, delta: Delta, stamp: string }>,
    serverCursor: ?CursorType,
    apply: (?Data, Delta) => Data,
    storeDeltas: boolean,
) {
    // console.log('Apply to collection', collection);
    const stores = storeDeltas
        ? [collection + ':meta', collection + ':nodes', collection + ':deltas']
        : [collection + ':meta', collection + ':nodes'];
    // console.log('Opening for stores', stores);
    const tx = (await db).transaction(stores, 'readwrite');
    if (storeDeltas) {
        const deltaStore = tx.objectStore(collection + ':deltas');
        deltas.forEach(obj => deltaStore.put(obj));
    }
    const nodes = tx.objectStore(collection + ':nodes');
    const idMap = {};
    deltas.forEach(d => (idMap[d.node] = true));
    const ids = Object.keys(idMap);
    const gotten = await Promise.all(ids.map(id => nodes.get(id)));
    // console.log('loaded up', ids, gotten);
    const map = {};
    gotten.forEach(res => {
        if (res) {
            map[res.id] = res.value;
        }
    });
    deltas.forEach(({ node, delta }) => {
        map[node] = apply(map[node], delta);
    });
    // console.log('idb changeMany processed', ids, map, serverCursor);
    ids.forEach(id => (map[id] ? nodes.put({ id, value: map[id] }) : null));
    if (serverCursor != null) {
        tx.objectStore(collection + ':meta').put(serverCursor, 'cursor');
    }
    await tx.done;
    return map;
};

export type IndexConfig = {
    keyPath: Array<string> | string,
};

const hasStore = (db, storeName) => {};

const makePersistence = (
    name: string,
    collections: Array<string>,
    version: number,
    indexes: { [colid: string]: { [indexId: string]: IndexConfig } },
): DeltaPersistence => {
    console.log('Persistence with name', name, version);
    const db: Promise<DB> = openDB(name, version, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log('okm ade the db');
            const currentStores = db.objectStoreNames;
            collections.forEach(name => {
                if (!currentStores.contains(name + ':deltas')) {
                    console.log('deltas');
                    db.createObjectStore(name + ':deltas', {
                        keyPath: 'stamp',
                    });
                }
                let nodeStore;
                if (!currentStores.contains(name + ':nodes')) {
                    nodeStore = db.createObjectStore(name + ':nodes', { keyPath: 'id' });
                } else {
                    nodeStore = transaction.objectStore(name + ':nodes');
                }
                if (indexes[name]) {
                    Object.keys(indexes[name]).forEach(indexName => {
                        const config = indexes[name][indexName];
                        if (!nodeStore.indexNames.contains(indexName)) {
                            nodeStore.createIndex(indexName, config.keyPath, { unique: false });
                        }
                    });
                }
                // stores "cursor", and that's it for the moment
                // In a multi-delta-persistence world, it would
                // store a cursor for each server.
                if (!currentStores.contains(name + ':meta')) {
                    db.createObjectStore(name + ':meta');
                }
            });
            console.log('made object stores');
        },
    }).then(
        s => {
            console.log('created', name);
            return s;
        },
        err => {
            console.log('failed to create', err);
            throw err;
        },
    );

    return {
        collections,
        tabIsolated: false,
        teardown() {
            return new Promise((res, rej) => {
                var DBDeleteRequest = window.indexedDB.deleteDatabase(name);

                DBDeleteRequest.onerror = function(event) {
                    console.log('Error deleting database.');
                    rej(event);
                };

                DBDeleteRequest.onsuccess = function(event) {
                    console.log('Database deleted successfully');

                    res();
                };
            });
        },
        async deltas<Delta>(
            collection: string,
        ): Promise<Array<{ node: string, delta: Delta, stamp: string }>> {
            return await (await db).getAll(collection + ':deltas');
        },
        async getServerCursor(collection: string): Promise<?number> {
            return await (await db).get(collection + ':meta', 'cursor');
        },
        async deleteDeltas(collection: string, upTo: string) {
            // console.log('delete up to', upTo);
            let cursor = await (await db)
                .transaction(collection + ':deltas', 'readwrite')
                // $FlowFixMe why doesn't flow like this
                .store.openCursor(IDBKeyRange.upperBound(upTo));
            while (cursor) {
                cursor.delete();
                cursor = await cursor.continue();
            }
        },
        async applyDelta<Delta, Data>(
            colid: string,
            id: string,
            delta: Delta,
            stamp: string,
            apply: (?Data, Delta) => Data,
        ): Promise<Data> {
            // console.log('Applying a single delta, local mutation');
            // console.log(new Error().stack);
            if (!collections.includes(colid)) {
                throw new Error('Unknown collection ' + colid);
            }
            const map = await applyDeltas(
                db,
                colid,
                [{ node: id, delta, stamp }],
                null,
                apply,
                true,
            );
            return map[id];
        },

        async load<T>(collection: string, id: string): Promise<?T> {
            const data = await (await db).get(collection + ':nodes', id);
            return data ? data.value : null;
        },
        async loadAll<T>(collection: string): Promise<{ [key: string]: T }> {
            const items = await (await db).getAll(collection + ':nodes');
            const res = {};
            items.forEach(item => (res[item.id] = item.value));
            return res;
        },
        // STOPSHP: Test this a bunch
        // Also, how should I memoize this??
        async query<T>(
            collection: string,
            key: string,
            op: '=' | '>=' | '<=' | '<' | '>',
            value: any,
        ): Promise<Array<{ key: string, value: T }>> {
            let base;
            if (key === 'key' || key === 'id') {
                // $FlowFixMe
                base = (await db).transaction(collection + ':nodes', 'readonly').store;
            } else {
                // $FlowFixMe
                base = (await db).transaction(collection + ':nodes', 'readonly').store.index(key);
            }
            let cursor = await base.openCursor(makeKeyRange(op, value));
            const values = [];

            while (cursor) {
                values.push({ key: cursor.key, value: cursor.value });
                cursor = await cursor.continue();
            }
            return values;
        },
        async fullExport<Data>(): Promise<Export<Data>> {
            console.log('dumping all');
            const dump = {};
            await Promise.all(
                collections.map(async colid => {
                    console.log('exporting', colid);
                    // const items = await (await db).getAll(colid + ':nodes');
                    dump[colid] = await this.loadAll(colid);
                    console.log('done');
                }),
            );
            return dump;
        },
        async applyDeltas<Delta, Data>(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, stamp: string }>,
            serverCursor: ?CursorType,
            apply: (?Data, Delta) => Data,
        ) {
            // console.log('got deltas from the server I guess');
            if (!collections.includes(collection)) {
                throw new Error('Unknown collection ' + collection);
            }
            return applyDeltas(db, collection, deltas, serverCursor, apply, serverCursor == null);
        },
    };
};

const makeKeyRange = (op: '=' | '>=' | '<=' | '<' | '>', value: any) => {
    switch (op) {
        case '=':
            // $FlowFixMe
            return IDBKeyRange.only(value);
        case '>=':
            // $FlowFixMe
            return IDBKeyRange.lowerBound(value);
        case '>':
            // $FlowFixMe
            return IDBKeyRange.lowerBound(value, true);
        case '<=':
            // $FlowFixMe
            return IDBKeyRange.upperBound(value);
        case '<':
            // $FlowFixMe
            return IDBKeyRange.upperBound(value, true);
    }
};

export default makePersistence;
