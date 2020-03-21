// @flow
import { openDB } from 'idb';
import * as hlc from '../../hybrid-logical-clock';
import type { HLC } from '../../hybrid-logical-clock';
import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import { type CursorType } from '../../../packages/core/src/types';
import deepEqual from 'fast-deep-equal';
import type {
    Persistence,
    FullPersistence,
    DeltaPersistence,
} from '../../core/src/types';
import type { DB, Transaction } from './types';

export const applyDeltas = async function<Delta, Data>(
    db: Promise<DB>,
    collection: string,
    deltas: Array<{ node: string, delta: Delta, stamp: string }>,
    serverCursor: ?CursorType,
    apply: (?Data, Delta) => Data,
    storeDeltas: boolean,
) {
    console.log('Apply to collection', collection);
    const stores = storeDeltas
        ? [collection + ':meta', collection + ':nodes', collection + ':deltas']
        : [collection + ':meta', collection + ':nodes'];
    console.log('Opening for stores', stores);
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
    if (serverCursor) {
        tx.objectStore(collection + ':meta').put(serverCursor, 'cursor');
    }
    await tx.done;
    return map;
};

const makePersistence = (
    name: string,
    collections: Array<string>,
): DeltaPersistence => {
    // console.log('Persistence with name', name);
    const db: Promise<DB> = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            collections.forEach(name => {
                db.createObjectStore(name + ':deltas', {
                    keyPath: 'stamp',
                });
                db.createObjectStore(name + ':nodes', { keyPath: 'id' });
                // stores "cursor", and that's it for the moment
                // In a multi-delta-persistence world, it would
                // store a cursor for each server.
                db.createObjectStore(name + ':meta');
            });
            console.log('made object stores');
        },
    });

    return {
        collections,
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
            return applyDeltas(
                db,
                collection,
                deltas,
                serverCursor,
                apply,
                false,
            );
        },
    };
};

export default makePersistence;
