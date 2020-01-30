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
        async getServerCursor(collection: string) {
            const db = await getDb(collection);
            return await db.get('meta', 'cursor');
        },
        async deleteDeltas(collection: string, upTo: string) {
            console.log('delete up to', upTo);
            const db = await getDb(collection);
            let cursor = await db
                .transaction('deltas', 'readwrite')
                // $FlowFixMe why doesn't flow like this
                .store.openCursor(IDBKeyRange.upperBound(upTo));

            while (cursor) {
                console.log('deleting', cursor.key, cursor.delete);
                console.log('del', cursor.delete());
                cursor = await cursor.continue();
            }
        },
        async get(collection: string, id: string) {
            const db = await getDb(collection);
            const data = await db.get('nodes', id);
            if (data) {
                return data.value;
            }
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
        async update<T>(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, stamp: string }>,
            apply: (?Data, Delta) => Data,
            serverCursor: ?CursorType,
            storeDeltas: boolean,
        ) {
            const db = await getDb(collection);
            const tx = db.transaction(
                storeDeltas ? ['meta', 'nodes', 'deltas'] : ['meta', 'nodes'],
                'readwrite',
            );
            if (storeDeltas) {
                const deltaStore = tx.objectStore('deltas');
                deltas.forEach(obj => deltaStore.put(obj));
            }
            const nodes = tx.objectStore('nodes');
            const idMap = {};
            deltas.forEach(d => (idMap[d.node] = true));
            const ids = Object.keys(idMap);
            const gotten = await Promise.all(ids.map(id => nodes.get(id)));
            console.log('loaded up', ids, gotten);
            const map = {};
            gotten.forEach(res => {
                if (res) {
                    map[res.id] = res.value;
                }
            });
            deltas.forEach(({ node, delta }) => {
                map[node] = apply(map[node], delta);
            });
            console.log('idb changeMany processed', ids, map);
            ids.forEach(id =>
                map[id] ? nodes.put({ id, value: map[id] }) : null,
            );
            if (serverCursor) {
                tx.objectStore('meta').put(serverCursor, 'cursor');
            }
            await tx.done;
            return map;
        },
    };
};

export default makePersistence;
