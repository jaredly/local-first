// @flow
import { openDB } from 'idb';
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { type CursorType } from '../client';
import deepEqual from 'fast-deep-equal';
import type { FullPersistence } from '../delta/types';

export const makePersistence = function(
    name: string,
    collections: Array<string>,
): FullPersistence {
    const db = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            collections.forEach(name =>
                db.createObjectStore('col:' + name, { keyPath: 'id' }),
            );
            db.createObjectStore('meta');
        },
    });
    const allStores = collections.map(name => 'col:' + name).concat(['meta']);

    return {
        collections,
        async load(collection: string, id: string) {
            const data = await (await db).get(collection, id);
            if (data) {
                return data.value;
            }
        },
        async loadAll(collection: string) {
            const items = await (await db).getAll(collection);
            const res = {};
            items.forEach(item => (res[item.id] = item.value));
            return res;
        },
        async updateMeta(serverEtag: ?string, dirtyStampToClear: ?string) {
            const tx = (await db).transaction('meta', 'readwrite');
            if (serverEtag) {
                tx.store.put(serverEtag, 'serverEtag');
            }
            if (dirtyStampToClear) {
                const current = tx.store.get('dirty');
                if (current === dirtyStampToClear) {
                    tx.store.put(null, 'dirty');
                }
            }
        },
        async getFull<Data>() {
            const tx = (await db).transaction(allStores, 'readonly');
            const dirty = await tx.objectStore('meta').get('dirty');
            const serverEtag = await tx.objectStore('meta').get('serverEtag');
            console.log('dirty', dirty);
            if (!dirty) {
                return { local: null, serverEtag };
            }
            const res = {};
            await Promise.all(
                collections.map(async id => {
                    res[id] = {};
                    const all = await tx.objectStore('col:' + id).getAll();
                    all.forEach(item => (res[id][item.id] = item.value));
                }),
            );
            return { local: { blob: res, stamp: dirty }, serverEtag };
        },
        async mergeFull<Data>(
            datas: { [col: string]: { [key: string]: Data } },
            etag: string,
            merge: (Data, Data) => Data,
        ) {
            const tx = (await db).transaction(
                Object.keys(datas)
                    .map(name => 'col:' + name)
                    .concat(['meta']),
                'readwrite',
            );
            const res = {};
            await Promise.all(
                Object.keys(datas).map(async col => {
                    const store = tx.objectStore('col:' + col);
                    res[col] = await store.getAll();
                    Object.keys(datas[col]).forEach(key => {
                        const prev = res[col][key];
                        if (prev) {
                            res[col][key] = merge(prev, datas[col][key]);
                        } else {
                            res[col][key] = datas[col][key];
                        }
                        if (!deepEqual(prev, res[col][key])) {
                            store.put(res[col][key]);
                        }
                    });
                }),
            );
            await tx.objectStore('meta').put(etag, 'serverEtag');
            const dirty = await tx.objectStore('meta').get('dirty');
            await tx.done;
            return { blob: res, stamp: dirty };
        },
        async applyDelta<Delta, Data>(
            collection: string,
            id: string,
            delta: Delta,
            stamp: string,
            apply: (?Data, Delta) => Data,
        ) {
            const tx = (await db).transaction(
                ['col:' + collection, 'meta'],
                'readwrite',
            );
            let data = await tx.objectStore('col:' + collection).get(id);
            const value = apply(data ? data.value : null, delta);

            const dirty = await tx.objectStore('meta').get('dirty');
            if (!dirty || dirty < stamp) {
                await tx.objectStore('meta').put(stamp, 'dirty');
            }

            await tx.objectStore('col:' + collection).put({ id, value });
            return data;
        },
    };
};

export default makePersistence;
