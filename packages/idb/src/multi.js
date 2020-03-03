/*
Ok what does usage look like though?
When adding a "backend", do you start over?
Like, you have to shut down the current client,
and then start a new one?
That would be somewhat disruptive probably.

What's our data structure look like?
- colid:nodes for the datas, same between both
- colid:deltas for the delta persistence
- colid:meta for the delta persistence, as each collection is synced independently.
- meta for the blob persistence, as all collections are tracked together.

hrmmmm

Okkk but this raises the question:
Do I want to be syncing all of the collections in tandem as well?
Like, I might be though. (such that I wouldn't have a deltas/meta per collection, just one for the whole batch)



Can I imagine wanting to do blob persistence & also not that?
Like, a persistence where for the prayer app that uses some kind of blobbyness?
Without pushing the whole thing up all the time, because that would be egregious.
idk, I'm gonna call that beyond scope.
If you're using delta sync, you could specify "only sync over wifi"
hrm nvm looks like there's no js api that can get that done for you.

But in an app you could.

Anyway, I'm totally developing this thing with notablemind in mind.
And it makes sense to me to save documents in different places.
Where a document consists of:
- "nodes"
- tags
- metadata/settings n stuff
- probably some other things? attachments maybe?
anyway, at least those two things.

And I can imagine wanting to sync to:
- a file (blog post y'all)
    - but also having a dedicated app where the file is the persistence instead of the network seems appealing to me as well.
- google drive
- my schmancy websocket backend hosted by glitch

Yeah let's just go for it, no compromises.
It won't be that much code, I can rewrite it all later.
*/

// @flow
import { openDB } from 'idb';
import * as hlc from '../../hybrid-logical-clock';
import type { HLC } from '../../hybrid-logical-clock';
import type { Delta, CRDT as Data } from '../../nested-object-crdt';
import deepEqual from 'fast-deep-equal';
import type { MultiPersistence, CursorType } from '../../core/src/types.js';

const colName = name => name + ':nodes';
const metaName = name => name + ':deltas-meta';
const deltasName = name => name + ':deltas';

const itemMap = items => {
    const res = {};
    items.forEach(item => (res[item.id] = item.value));
    return res;
};

export const applyDeltas = async function<Delta, Data>(
    db: Promise<*>,
    collection: string,
    deltas: Array<{ node: string, delta: Delta, stamp: string }>,
    serverCursor: ?CursorType,
    apply: (?Data, Delta) => Data,
    // if null, we're getting the data from remote, so don't mark dirty
    // or store the deltas
    blobServerIds: ?Array<string>,
) {
    console.log('Apply to collection', collection, deltas.length, 'deltas');
    const stores = [deltasName(collection), colName(collection)];
    if (blobServerIds != null) {
        stores.push('blob-meta');
    }
    if (serverCursor) {
        stores.push(metaName(collection));
    }
    const tx = (await db).transaction(stores, 'readwrite');
    if (blobServerIds != null) {
        const deltaStore = tx.objectStore(deltasName(collection));
        console.log(`PUTTING DELTAS`);
        deltas.forEach(obj => deltaStore.put(obj));
    }
    const nodes = tx.objectStore(colName(collection));
    const idMap = {};
    deltas.forEach(d => (idMap[d.node] = true));
    const ids = Object.keys(idMap);
    const gotten = await Promise.all(ids.map(id => nodes.get(id)));
    const map = {};
    gotten.forEach(res => {
        if (res) {
            map[res.id] = res.value;
        }
    });
    deltas.forEach(({ node, delta }) => {
        map[node] = apply(map[node], delta);
    });
    ids.forEach(id => (map[id] ? nodes.put({ id, value: map[id] }) : null));
    if (serverCursor) {
        tx.objectStore(metaName(collection)).put(serverCursor, 'cursor');
    }
    if (blobServerIds != null && blobServerIds.length > 0) {
        // ok this assumption here (that I can get the maxStamp by
        // just taking the stamp of each delta) gets a little tricky
        // if I'm deriving the deltas from a full upgrade.
        // But that just means that I need to do a deep check for the
        // stamps of the deltas, which should be fine.
        let maxStamp = deltas[0].stamp;
        for (let i = 1; i < deltas.length; i++) {
            if (deltas[i].stamp > maxStamp) {
                maxStamp = deltas[i].stamp;
            }
        }
        console.log(
            'Setting dirty as',
            maxStamp,
            'for blob servers',
            blobServerIds,
        );

        await Promise.all(
            blobServerIds.map(async sid => {
                const dirty = await tx
                    .objectStore('blob-meta')
                    .get(sid + '-dirty');
                if (!dirty || dirty < maxStamp) {
                    await tx
                        .objectStore('blob-meta')
                        .put(maxStamp, sid + '-dirty');
                }
            }),
        );
    }
    await tx.done;
    return map;
};

const makeDb = async (
    name,
    collections,
    deltaServer,
    deltaCreate,
    blobServerIds,
) => {
    const db = await openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log('Setting up database');
            collections.forEach(name => {
                db.createObjectStore(deltasName(name), {
                    keyPath: 'stamp',
                });
                db.createObjectStore(colName(name), { keyPath: 'id' });
                // stores "cursor", and that's it for the moment
                // In a multi-delta-persistence world, it would
                // store a cursor for each server.
                // Ok also stores a "last seen" for a given serverId
                // So that we can know when to delete deltas
                // (once all of them have seen it).
                // If there's only one deltaServerId, that makes
                // it easier.
                db.createObjectStore(metaName(name));
            });
            // stores
            // sid-dirty (dirty with respect to this server?)
            // sid-serverEtag
            db.createObjectStore('blob-meta');
        },
    });
    if (blobServerIds) {
        const tx = db.transaction('blob-meta', 'readwrite');
        await Promise.all(
            blobServerIds.map(async id => {
                const dirty = await tx.store.get(id + '-dirty');
                // only if undefined, meaning not yet set
                if (!dirty && dirty !== null) {
                    tx.store.put('0', id + '-dirty');
                }
                // console.log('[blob init]', id, dirty);
            }),
        );
        await tx.done;
    }
    if (deltaServer) {
        console.log('!!! yes server');
        for (const collection of collections) {
            const cursor = await db.get(metaName(collection), 'cursor');
            // No server cursor, and no deltas saved
            const deltas = await db.count(deltasName(collection));
            if (!cursor && deltas === 0) {
                console.log('!!! need to backfill');
                const tx = db.transaction(
                    [colName(collection), deltasName(collection)],
                    'readwrite',
                );
                const items = await tx
                    .objectStore(colName(collection))
                    .getAll();
                const deltas = tx.objectStore(deltasName(collection));
                for (const item of items) {
                    const delta = deltaCreate(item.value, item.id);
                    deltas.put(delta);
                }
                console.log('put in', items.length, 'deltas');
                await tx.done;
            } else {
                console.log(
                    'not that',
                    cursor,
                    deltas,
                    typeof cursor,
                    !cursor,
                    deltas == 0,
                    deltas === 0,
                );
            }
        }
    }

    return db;
};

const makePersistence = (
    name: string,
    collections: Array<string>,
    deltaServer: boolean,
    blobServerIds: Array<string>,
    deltaCreate: (
        data: Data,
        id: string,
    ) => { node: string, delta: Delta, stamp: string },
): MultiPersistence => {
    const db = makeDb(
        name,
        collections,
        deltaServer,
        deltaCreate,
        blobServerIds,
    );

    return {
        collections,
        async deltas<Delta>(
            collection: string,
        ): Promise<Array<{ node: string, delta: Delta, stamp: string }>> {
            if (!deltaServer) {
                throw new Error(`No delta server configured`);
            }
            console.log('getting deltas');
            return await (await db).getAll(deltasName(collection));
        },

        async getServerCursor(collection: string): Promise<?number> {
            if (!deltaServer) {
                throw new Error(`No delta server configured`);
            }
            return await (await db).get(metaName(collection), 'cursor');
        },

        async deleteDeltas(collection: string, upTo: string) {
            if (!deltaServer) {
                throw new Error(`No delta server configured`);
            }
            console.log('DELETING DELTAS');
            let cursor = await (await db)
                .transaction(deltasName(collection), 'readwrite')
                // $FlowFixMe why doesn't flow like this
                .store.openCursor(IDBKeyRange.upperBound(upTo));
            while (cursor) {
                cursor.delete();
                cursor = await cursor.continue();
            }
            return;
        },

        async applyDelta<Delta, Data>(
            colid: string,
            id: string,
            delta: Delta,
            stamp: string,
            apply: (?Data, Delta) => Data,
        ): Promise<Data> {
            if (!collections.includes(colid)) {
                throw new Error('Unknown collection ' + colid);
            }
            if (!deltaServer) {
                const tx = (await db).transaction(
                    [colName(colid), 'blob-meta'],
                    'readwrite',
                );
                let data = await tx.objectStore(colName(colid)).get(id);
                const value = apply(data ? data.value : null, delta);

                blobServerIds.forEach(async serverId => {
                    const dirty = await tx
                        .objectStore('blob-meta')
                        .get(serverId + '-dirty');
                    if (!dirty || dirty < stamp) {
                        await tx
                            .objectStore('meta')
                            .put(stamp, serverId + '-dirty');
                    }
                });

                await tx.objectStore(colName(colid)).put({ id, value });
                await tx.done;
                return value;
            }
            const map = await applyDeltas(
                db,
                colid,
                [{ node: id, delta, stamp }],
                null,
                apply,
                blobServerIds,
            );
            return map[id];
        },

        async load<T>(collection: string, id: string): Promise<?T> {
            const data = await (await db).get(colName(collection), id);
            return data ? data.value : null;
        },
        async loadAll<T>(collection: string): Promise<{ [key: string]: T }> {
            const items = await (await db).getAll(colName(collection));
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
            if (!deltaServer) {
                throw new Error(`No delta server configured`);
            }
            if (!collections.includes(collection)) {
                throw new Error('Unknown collection ' + collection);
            }
            return applyDeltas(
                db,
                collection,
                deltas,
                serverCursor,
                apply,
                blobServerIds,
            );
        },

        async updateMeta(
            serverId: string,
            serverEtag: ?string,
            dirtyStampToClear: ?string,
        ) {
            const tx = (await db).transaction('blob-meta', 'readwrite');
            if (serverEtag) {
                tx.store.put(serverEtag, serverId + '-serverEtag');
            }
            if (dirtyStampToClear) {
                const current = tx.store.get(serverId + '-dirty');
                if (current === dirtyStampToClear) {
                    tx.store.put(null, serverId + '-dirty');
                }
            }
        },
        async getFull<Data>(serverId: string) {
            const tx = (await db).transaction(
                collections.map(colName).concat('blob-meta'),
                'readonly',
            );
            const dirty = await tx
                .objectStore('blob-meta')
                .get(serverId + '-dirty');
            const serverEtag = await tx
                .objectStore('blob-meta')
                .get(serverId + '-serverEtag');
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

        async mergeFull<Delta, Data>(
            serverId: string,
            datas: { [col: string]: { [key: string]: Data } },
            etag: string,
            merge: (Data, Data) => Data,
            diff: (?Data, Data) => Delta,
            ts: () => string,
        ) {
            if (deltaServer) {
                const tx = (await db).transaction(
                    []
                        .concat(
                            ...Object.keys(datas).map(name => [
                                deltasName(name),
                                colName(name),
                            ]),
                        )
                        .concat(['blob-meta']),
                    'readwrite',
                );
                if (blobServerIds.length > 1) {
                    const newDirtyStamp = ts();
                    await Promise.all(
                        blobServerIds
                            .filter(id => id !== serverId)
                            .map(async sid => {
                                await tx
                                    .objectStore('blob-meta')
                                    .put(newDirtyStamp, sid + '-dirty');
                            }),
                    );
                }
                const blob = {};
                const changedIds = {};
                let anyChanged = false;
                await Promise.all(
                    Object.keys(datas).map(async col => {
                        const deltas = [];
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
                                deltas.push({
                                    node: key,
                                    delta: diff(prev, blob[col][key]),
                                    stamp: ts(),
                                });
                                anyChanged = true;
                                if (!changedIds[col]) {
                                    changedIds[col] = [key];
                                } else {
                                    changedIds[col].push(key);
                                }
                                store.put({ id: key, value: blob[col][key] });
                            }
                        });
                        const deltaStore = tx.objectStore(deltasName(col));
                        console.log('PUTTING DELTAS');
                        deltas.forEach(delta => deltaStore.put(delta));
                    }),
                );
                console.log('After merge, any changed?', anyChanged);
                await tx
                    .objectStore('blob-meta')
                    .put(etag, serverId + '-serverEtag');
                const dirty = await tx
                    .objectStore('blob-meta')
                    .get(serverId + '-dirty');
                await tx.done;
                if (!anyChanged) {
                    return null;
                }
                return {
                    merged: { blob, stamp: dirty },
                    changedIds,
                };
            }

            const tx = (await db).transaction(
                Object.keys(datas)
                    .map(name => colName(name))
                    .concat(['blob-meta']),
                'readwrite',
            );

            if (blobServerIds.length > 1) {
                const newDirtyStamp = ts();
                await Promise.all(
                    blobServerIds
                        .filter(id => id !== serverId)
                        .map(async sid => {
                            await tx
                                .objectStore('blob-meta')
                                .put(newDirtyStamp, sid + '-dirty');
                        }),
                );
            }

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
            await tx
                .objectStore('blob-meta')
                .put(etag, serverId + '-serverEtag');
            const dirty = await tx
                .objectStore('blob-meta')
                .get(serverId + '-dirty');
            await tx.done;
            if (!anyChanged) {
                return null;
            }
            return {
                merged: { blob, stamp: dirty },
                changedIds,
            };
        },
    };
};

export default makePersistence;
