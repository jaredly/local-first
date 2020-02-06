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
import type { Persistence, FullPersistence, DeltaPersistence } from '../types';

export const applyDeltas = async function<Delta, Data>(
    db: Promise<*>,
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
    // console.log('Opening for stores', stores);
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
    const db = openDB(name, 1, {
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
