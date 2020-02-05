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
            const data = await (await db).get('col:' + collection, id);
            if (data) {
                return data.value;
            }
        },
        async loadAll(collection: string) {
            const items = await (await db).getAll('col:' + collection);
            const res = {};
            items.forEach(item => (res[item.id] = item.value));
            await new Promise(res => setTimeout(res, 50));
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
            if (!dirty) {
                return { local: null, serverEtag };
            }
            const blob = {};
            await Promise.all(
                collections.map(async colid => {
                    blob[colid] = {};
                    const all = await tx.objectStore('col:' + colid).getAll();
                    all.forEach(item => (blob[colid][item.id] = item.value));
                }),
            );
            return { local: { blob, stamp: dirty }, serverEtag };
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
            const blob = {};
            const changedIds = {};
            await Promise.all(
                Object.keys(datas).map(async col => {
                    const store = tx.objectStore('col:' + col);
                    blob[col] = {};
                    const items = await store.getAll();
                    items.forEach(item => (blob[col][item.id] = item.value));
                    Object.keys(datas[col]).forEach(key => {
                        const prev = blob[col][key];
                        if (prev) {
                            blob[col][key] = merge(prev, datas[col][key]);
                        } else {
                            blob[col][key] = datas[col][key];
                        }
                        if (!deepEqual(prev, blob[col][key])) {
                            if (!changedIds[col]) {
                                changedIds[col] = [key];
                            } else {
                                changedIds[col].push(key);
                            }
                            store.put({ id: key, value: blob[col][key] });
                        }
                    });
                }),
            );
            await tx.objectStore('meta').put(etag, 'serverEtag');
            const dirty = await tx.objectStore('meta').get('dirty');
            // console.log('Merged', blob);
            await tx.done;
            return { merged: { blob, stamp: dirty }, changedIds };
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
