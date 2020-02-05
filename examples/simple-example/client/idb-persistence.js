// @flow
import { openDB } from 'idb';
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { type CursorType } from '../fault-tolerant/client';
import deepEqual from 'fast-deep-equal';
import type {
    Persistence,
    CorePersistence,
    FullPersistence,
} from '../fault-tolerant/types';

const genId = (): string =>
    Math.random()
        .toString(36)
        .slice(2);

const saveHLC = (name: string, clock: HLC) =>
    localStorage.setItem(name + ':hlc', hlc.pack(clock));
const getHLC = (name: string) => {
    const packed = localStorage.getItem(name + ':hlc');
    if (packed) {
        return hlc.unpack(packed);
    } else {
        const clock = hlc.init(genId(), Date.now());
        localStorage.setItem(name + ':hlc', hlc.pack(clock));
        return clock;
    }
};

// export const makeFullPersistence = function<Data>(
//     name: string,
//     collections: Array<string>,
// ): FullPersistence<Data> {
//     const db = openDB(name, 1, {
//         upgrade(db, oldVersion, newVersion, transaction) {
//             collections.forEach(name =>
//                 db.createObjectStore(name, { keyPath: 'id' }),
//             );
//         },
//     });

//     return {
//         collections,
//         saveHLC: (clock: HLC) => saveHLC(name, clock),
//         getHLC: () => getHLC(name),
//         async get(collection: string, id: string) {
//             const data = await (await db).get(collection, id);
//             if (data) {
//                 return data.value;
//             }
//         },
//         async getAll(collection: string) {
//             const items = await (await db).getAll(collection);
//             const res = {};
//             items.forEach(item => (res[item.id] = item.value));
//             return res;
//         },
//         async getFull() {
//             const tx = (await db).transaction(collections, 'readonly');
//             const res = {};
//             await Promise.all(
//                 collections.map(async id => {
//                     res[id] = {};
//                     const all = await tx.objectStore(id).getAll();
//                     all.forEach(item => (res[id][item.id] = item.value));
//                 }),
//             );
//             return res;
//         },
//         async updateFull(
//             datas: { [col: string]: { [key: string]: Data } },
//             merge: (Data, Data) => Data,
//         ) {
//             const tx = (await db).transaction(Object.keys(datas), 'readwrite');
//             const res = {};
//             await Promise.all(
//                 Object.keys(datas).map(async col => {
//                     const store = tx.objectStore(col);
//                     res[col] = await store.getAll();
//                     Object.keys(datas[col]).forEach(key => {
//                         const prev = res[col][key];
//                         if (res[col][key]) {
//                             res[col][key] = merge(
//                                 res[col][key],
//                                 datas[col][key],
//                             );
//                         } else {
//                             res[col][key] = datas[col][key];
//                         }
//                         if (!deepEqual(prev, res[col][key])) {
//                             store.put(res[col][key]);
//                         }
//                     });
//                 }),
//             );
//             await tx.done;
//             return res;
//         },
//         async update<Delta>(
//             collection: string,
//             deltas: Array<{ node: string, delta: Delta }>,
//             apply: (?Data, Delta) => Data,
//         ) {
//             const tx = (await db).transaction(collection, 'readwrite');
//             const changedIds = {};
//             deltas.forEach(d => (changedIds[d.node] = true));

//             const gotten = await Promise.all(
//                 Object.keys(changedIds).map(id => tx.store.get(id)),
//             );
//             const data = {};
//             gotten.forEach(res => {
//                 if (res) {
//                     data[res.id] = res.value;
//                 }
//             });

//             deltas.forEach(({ node, delta }) => {
//                 data[node] = apply(data[node], delta);
//             });
//             await Promise.all(
//                 Object.keys(changedIds).map(id =>
//                     tx.store.put({ id, value: data[id] }),
//                 ),
//             );
//             return data;
//         },
//     };
// };

// const makeFullPersistence = <Delta, Data>(
//     name: string,
//     collections: Array<string>,
// ): FullPersistence<Delta, Data> => {
//     const {db, core} = makeCorePersistence(name, collections);
//     return {
//         ...core,
//         async getFull() {
//             const collections = await collections.map(id => )
//         }
//     }
// }

const makePersistence = <Delta, Data>(
    name: string,
    collections: Array<string>,
): Persistence<Delta, Data> => {
    const db = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            collections.forEach(name => {
                db.createObjectStore(name + ':deltas', {
                    keyPath: 'stamp',
                });
                db.createObjectStore(name + ':nodes', { keyPath: 'id' });
                db.createObjectStore(name + ':meta');
            });
        },
    });

    return {
        collections,
        saveHLC: (clock: HLC) => saveHLC(name, clock),
        getHLC: () => getHLC(name),
        async deltas(collection: string) {
            return await (await db).getAll(collection + ':deltas');
        },
        async getServerCursor(collection: string) {
            return await (await db).get(collection + ':meta', 'cursor');
        },
        async deleteDeltas(collection: string, upTo: string) {
            console.log('delete up to', upTo);
            let cursor = await (await db)
                .transaction(name + ':deltas', 'readwrite')
                // $FlowFixMe why doesn't flow like this
                .store.openCursor(IDBKeyRange.upperBound(upTo));
            while (cursor) {
                cursor.delete();
                cursor = await cursor.continue();
            }
        },
        async get(collection: string, id: string) {
            const data = await (await db).get(collection + ':nodes', id);
            return data ? data.value : null;
        },
        async getAll(collection: string) {
            const items = await (await db).getAll(collection + ':nodes');
            const res = {};
            items.forEach(item => (res[item.id] = item.value));
            return res;
        },
        async update<T>(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, stamp: string }>,
            apply: (?Data, Delta) => Data,
            serverCursor: ?CursorType,
            storeDeltas: boolean,
        ) {
            const tx = (await db).transaction(
                storeDeltas
                    ? [
                          collection + ':meta',
                          collection + ':nodes',
                          collection + ':deltas',
                      ]
                    : [collection + ':meta', collection + ':nodes'],
                'readwrite',
            );
            if (storeDeltas) {
                const deltaStore = tx.objectStore(collection + ':deltas');
                deltas.forEach(obj => deltaStore.put(obj));
            }
            const nodes = tx.objectStore(collection + ':nodes');
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
                tx.objectStore(collection + ':meta').put(
                    serverCursor,
                    'cursor',
                );
            }
            await tx.done;
            return map;
        },
    };
};

export default makePersistence;
