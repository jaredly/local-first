// @flow
import { openDB } from 'idb';
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { type CursorType } from '../client';
import deepEqual from 'fast-deep-equal';
import type { FullPersistence } from '../delta/types';

export const makePersistence = function<Data>(
    name: string,
    collections: Array<string>,
): FullPersistence {
    const db = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            collections.forEach(name =>
                db.createObjectStore(name, { keyPath: 'id' }),
            );
        },
    });

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
        async getFull() {
            const tx = (await db).transaction(collections, 'readonly');
            const res = {};
            await Promise.all(
                collections.map(async id => {
                    res[id] = {};
                    const all = await tx.objectStore(id).getAll();
                    all.forEach(item => (res[id][item.id] = item.value));
                }),
            );
            return res;
        },
        async mergeFull<Data>(
            datas: { [col: string]: { [key: string]: Data } },
            merge: (Data, Data) => Data,
        ) {
            const tx = (await db).transaction(Object.keys(datas), 'readwrite');
            const res = {};
            await Promise.all(
                Object.keys(datas).map(async col => {
                    const store = tx.objectStore(col);
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
            await tx.done;
            return res;
        },
        async applyDelta<Delta>(
            collection: string,
            deltas: Array<{ node: string, delta: Delta }>,
            apply: (?Data, Delta) => Data,
        ) {
            const tx = (await db).transaction(collection, 'readwrite');
            const changedIds = {};
            deltas.forEach(d => (changedIds[d.node] = true));

            const gotten = await Promise.all(
                Object.keys(changedIds).map(id => tx.store.get(id)),
            );
            const data = {};
            gotten.forEach(res => {
                if (res) {
                    data[res.id] = res.value;
                }
            });

            deltas.forEach(({ node, delta }) => {
                data[node] = apply(data[node], delta);
            });
            await Promise.all(
                Object.keys(changedIds).map(id =>
                    tx.store.put({ id, value: data[id] }),
                ),
            );
            return data;
        },
    };
};

export default makePersistence;
