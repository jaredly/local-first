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
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { type CursorType } from '../types';
import deepEqual from 'fast-deep-equal';
import type { MultiPersistence } from '../types';

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
    serverCursor: ?{ id: string, cursor: CursorType },
    apply: (?Data, Delta) => Data,
    // if null, we're getting the data from remote, so don't mark dirty
    // or store the deltas
    blobServerIds: ?Array<string>,
) {
    console.log('Apply to collection', collection, 'year');
    const stores =
        blobServerIds != null
            ? [
                  deltasName(collection),
                  colName(collection),
                  metaName(collection),
                  'blob-meta',
              ]
            : [deltasName(collection), colName(collection)];
    const tx = (await db).transaction(stores, 'readwrite');
    if (blobServerIds != null) {
        const deltaStore = tx.objectStore(deltasName(collection));
        deltas.forEach(obj => deltaStore.put(obj));
    }
    const nodes = tx.objectStore(colName(collection));
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
        tx.objectStore(metaName(collection)).put(
            serverCursor.cursor,
            serverCursor.id + '-cursor',
        );
    }
    if (blobServerIds != null) {
        let maxStamp = deltas[0].stamp;
        for (let i = 1; i < deltas.length; i++) {
            if (deltas[i].stamp > maxStamp) {
                maxStamp = deltas[i].stamp;
            }
        }
        await Promise.all(
            blobServerIds.map(async sid => {
                // await tx.objectStore('blob-meta').put();
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

const makePersistence = (
    name: string,
    collections: Array<string>,
    deltaServerIds: Array<string>,
    blobServerIds: Array<string>,
): MultiPersistence => {
    const db = openDB(name, 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
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

    return {
        collections,
        async deltas<Delta>(
            serverId: string,
            collection: string,
        ): Promise<Array<{ node: string, delta: Delta, stamp: string }>> {
            if (deltaServerIds.length === 1) {
                return await (await db).getAll(deltasName(collection));
            }
            const tx = (await db).transaction(
                [deltasName(collection), metaName(collection)],
                'readonly',
            );
            const ack = await tx
                .objectStore(metaName(collection))
                .get(serverId + '-ack');
            if (ack) {
                const results = [];
                let cursor = await tx
                    .objectStore(deltasName(collection))
                    // $FlowFixMe
                    .openCursor(IDBKeyRange.lowerBound(ack, true));
                while (cursor) {
                    results.push(cursor.value);
                    cursor = await cursor.continue();
                }
                return results;
            } else {
                return tx.objectStore(deltasName(collection)).getAll();
            }
        },

        async getServerCursor(
            serverId: string,
            collection: string,
        ): Promise<?number> {
            return await (await db).get(
                metaName(collection),
                serverId + '-cursor',
            );
        },

        async deleteDeltas(serverId: string, collection: string, upTo: string) {
            if (deltaServerIds.length === 1) {
                // console.log('delete up to', upTo);
                let cursor = await (await db)
                    .transaction(deltasName(collection), 'readwrite')
                    // $FlowFixMe why doesn't flow like this
                    .store.openCursor(IDBKeyRange.upperBound(upTo));
                while (cursor) {
                    cursor.delete();
                    cursor = await cursor.continue();
                }
                return;
            }

            const tx = (await db).transaction(
                [deltasName(collection), metaName(collection)],
                'readwrite',
            );
            const acks = {};
            let preMin = null;
            for (const sid of deltaServerIds) {
                acks[sid] = await tx
                    .objectStore(metaName(collection))
                    .get(sid + '-ack');
                if (acks[sid] && (!preMin || acks[sid] < preMin)) {
                    preMin = acks[sid];
                }
            }
            acks[serverId] = upTo;
            await tx
                .objectStore(metaName(collection))
                .put(upTo, serverId + '-ack');
            let postMin = upTo;
            deltaServerIds.forEach(sid => {
                if (acks[sid] < postMin) {
                    postMin = acks[sid];
                }
            });
            if (!preMin || postMin > preMin) {
                // we have things to delete!
                let cursor = await tx
                    .objectStore(deltasName(collection))
                    // $FlowFixMe
                    .openCursor(IDBKeyRange.upperBound(postMin));
                while (cursor) {
                    cursor.delete();
                    cursor = await cursor.continue();
                }
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
                blobServerIds,
            );
            return map[id];
        },

        // async applyDelta<Delta, Data>(
        //     collection: string,
        //     id: string,
        //     delta: Delta,
        //     stamp: string,
        //     apply: (?Data, Delta) => Data,
        // ) {
        //     const tx = (await db).transaction(
        //         [colName(collection), 'blob-meta'],
        //         'readwrite',
        //     );
        //     let data = await tx.objectStore(colName(collection)).get(id);
        //     const value = apply(data ? data.value : null, delta);

        //     const dirty = await tx.objectStore('blob-meta').get('dirty');
        //     if (!dirty || dirty < stamp) {
        //         await tx.objectStore('blob-meta').put(stamp, 'dirty');
        //     }

        //     await tx.objectStore(colName(collection)).put({ id, value });
        //     return value;
        // },

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
            serverId: string,
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
                serverCursor ? { cursor: serverCursor, id: serverId } : null,
                apply,
                null,
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
        async mergeFull<Data>(
            serverId: string,
            datas: { [col: string]: { [key: string]: Data } },
            etag: string,
            merge: (Data, Data) => Data,
        ) {
            const tx = (await db).transaction(
                Object.keys(datas)
                    .map(name => colName(name))
                    .concat(['blob-meta']),
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
            await tx
                .objectStore('blob-meta')
                .put(etag, serverId + '-serverEtag');
            const dirty = await tx
                .objectStore('blob-meta')
                .get(serverId + '-dirty');
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
    };
};

export default makePersistence;
