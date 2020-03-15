// @flow
import { openDB } from 'idb';
import * as hlc from '../../../packages/hybrid-logical-clock';
import type { HLC } from '../../../packages/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import deepEqual from '@birchill/json-equalish';
import type { FullPersistence } from '../../core/src/types';
import type { DB, Transaction } from './types';

// export const

const itemMap = items => {
    const res = {};
    items.forEach(item => (res[item.id] = item.value));
    return res;
};

export const makePersistence = function(
    name: string,
    collections: Array<string>,
): FullPersistence {
    const colName = name => name + ':nodes';
    const db: Promise<DB> = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            collections.forEach(name =>
                db.createObjectStore(colName(name), { keyPath: 'id' }),
            );
            db.createObjectStore('meta');
        },
    });
    const allStores = collections.map(name => colName(name)).concat(['meta']);

    return {
        collections,
        async load(collection: string, id: string) {
            const data = await (await db).get(colName(collection), id);
            return data ? data.value : null;
        },
        async loadAll(collection: string) {
            return itemMap(await (await db).getAll(colName(collection)));
        },
        async updateMeta(serverEtag: ?string, dirtyStampToClear: ?string) {
            const tx = (await db).transaction('meta', 'readwrite');
            if (serverEtag) {
                tx.store.put(serverEtag, 'serverEtag');
            }
            if (dirtyStampToClear) {
                const current = await tx.store.get('dirty');
                if (current === dirtyStampToClear) {
                    tx.store.put(null, 'dirty');
                } else {
                    console.log(
                        'not clearing dirty',
                        current,
                        dirtyStampToClear,
                    );
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
                    blob[colid] = itemMap(
                        await tx.objectStore(colName(colid)).getAll(),
                    );
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
                    .map(name => colName(name))
                    .concat(['meta']),
                'readwrite',
            );
            const blob = {};
            const changedIds = {};
            let anyChanged = false;
            await Promise.all(
                Object.keys(datas).map(async col => {
                    const store = tx.objectStore(colName(col));
                    blob[col] = itemMap(await store.getAll());
                    Object.keys(datas[col]).forEach(key => {
                        const prev = blob[col][key];
                        if (prev) {
                            blob[col][key] = merge(prev, datas[col][key]);
                        } else {
                            blob[col][key] = datas[col][key];
                        }
                        if (!deepEqual(prev, blob[col][key])) {
                            anyChanged = true;
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
            console.log('After merge, any changed?', anyChanged);
            await tx.objectStore('meta').put(etag, 'serverEtag');
            const dirty = await tx.objectStore('meta').get('dirty');
            // console.log('Merged', blob);
            await tx.done;
            if (!anyChanged) {
                return null;
            }
            return {
                merged: { blob, stamp: dirty },
                changedIds,
            };
        },
        async applyDelta<Delta, Data>(
            collection: string,
            id: string,
            delta: Delta,
            stamp: string,
            apply: (?Data, Delta) => Data,
        ) {
            const tx = (await db).transaction(
                [colName(collection), 'meta'],
                'readwrite',
            );
            let data = await tx.objectStore(colName(collection)).get(id);
            const value = apply(data ? data.value : null, delta);

            const dirty = await tx.objectStore('meta').get('dirty');
            if (!dirty || dirty < stamp) {
                await tx.objectStore('meta').put(stamp, 'dirty');
            }

            await tx.objectStore(colName(collection)).put({ id, value });
            return value;
        },
    };
};

export default makePersistence;
