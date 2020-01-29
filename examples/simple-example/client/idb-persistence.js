// @flow
import { openDB } from 'idb';
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { type CursorType } from '../fault-tolerant/client';
import type { Persistence } from '../fault-tolerant/clientTypes';

const genId = (): string =>
    Math.random()
        .toString(36)
        .slice(2);

const makePersistence = <Delta, Data>(): Persistence<Delta, Data> => {
    const dbs = {};
    const getDb = async collection => {
        if (dbs[collection]) {
            return dbs[collection];
        }

        const db = (dbs[collection] = await openDB('collection', 1, {
            upgrade(db, oldVersion, newVersion, transation) {
                db.createObjectStore('deltas', {
                    keyPath: 'stamp',
                });
                db.createObjectStore('nodes', { keyPath: 'id' });
                db.createObjectStore('meta');
            },

            // TODO handle blocked, blocking, etc.
        }));
        return db;
    };

    return {
        saveHLC(clock: HLC) {
            localStorage.setItem('hlc', hlc.pack(clock));
        },
        getHLC() {
            const packed = localStorage.getItem('hlc');
            if (packed) {
                return hlc.unpack(packed);
            } else {
                const clock = hlc.init(genId(), Date.now());
                localStorage.setItem('hlc', hlc.pack(clock));
                return clock;
            }
        },
        async deltas(collection: string) {
            const db = await getDb(collection);
            const all = await db.getAll('deltas');
            return all;
        },
        async addDeltas(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        ) {
            const db = await getDb(collection);
            const tx = db.transaction('deltas', 'readwrite');
            deltas.forEach(obj => tx.store.put(obj));
            await tx.done;
        },
        async getServerCursor(collection: string) {
            const db = await getDb(collection);
            return await db.get('meta', 'cursor');
        },
        async deleteDeltas(collection: string, upTo: string) {
            console.log('delete up to', upTo);
            const db = await getDb(collection);
            let cursor = await db
                .transaction('deltas', 'readwrite')
                .store.openCursor(IDBKeyRange.upperBound(upTo));

            while (cursor) {
                console.log('deleting', cursor.key, cursor.delete);
                console.log('del', cursor.delete());
                cursor = await cursor.continue();
            }
        },
        async get(collection: string, id: string) {
            const db = await getDb(collection);
            return await db.get('nodes', id);
        },
        async getAll(collection: string) {
            const db = await getDb(collection);
            const items = await db.getAll('nodes');
            const res = {};
            console.log('items', items);
            items.forEach(item => (res[item.id] = item.value));
            console.log('all', res);
            return res;
        },
        async changeMany<T>(
            collection: string,
            ids: Array<string>,
            process: ({ [key: string]: T }) => void,
            serverCursor: ?CursorType,
        ) {
            const db = await getDb(collection);
            const tx = db.transaction(['meta', 'nodes'], 'readwrite');
            const nodes = tx.objectStore('nodes');
            const gotten = await Promise.all(ids.map(id => nodes.get(id)));
            console.log('gotten', gotten);
            const map = {};
            gotten.forEach(res => (res ? (map[res.id] = res.value) : null));
            // console.log('pre-process', JSON.stringify(map));
            process(map);
            console.log('processed', ids, map);
            ids.forEach(id =>
                map[id] ? nodes.put({ id, value: map[id] }) : null,
            );
            if (serverCursor) {
                tx.objectStore('meta').put(serverCursor, 'cursor');
            }
            return map;
        },
    };
};

export default makePersistence;
