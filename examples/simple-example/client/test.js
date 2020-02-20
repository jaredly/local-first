// @flow
import * as hlc from '../../../packages/hybrid-logical-clock';
import type { HLC } from '../../../packages/hybrid-logical-clock';
import * as crdt from '../../../packages/nested-object-crdt';
import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import { ItemSchema } from '../shared/schema.js';

import createClient from '../../../packages/core/src/delta/create-client';
import makeDeltaPersistence from '../../../packages/core/src/delta/idb-persistence';
import createPollingNetwork from '../../../packages/core/src/delta/polling-network';
import createWebSocketNetwork from '../../../packages/core/src/delta/websocket-network';

import createBlobClient from '../../../packages/core/src/blob/create-client';
import makeBlobPersistence from '../../../packages/core/src/blob/idb-persistence';
import createBasicBlobNetwork from '../../../packages/core/src/blob/basic-network';

import createMultiClient from '../../../packages/core/src/multi/create-client';
import makeMultiPersistence from '../../../packages/core/src/multi/idb-persistence';
import { PersistentClock, localStorageClockPersist } from './persistent-clock';

window.setupLocalCache = async collection => {
    window.collection = window.client.getCollection(collection);
    window.data = await window.collection.loadAll();
    window.collection.onChanges(changes => {
        changes.forEach(({ value, id }) => {
            if (value) {
                window.data[id] = value;
            } else {
                delete window.data[id];
            }
        });
    });
};

window.clearData = async () => {
    Object.keys(localStorage).forEach(key => {
        localStorage.removeItem(key);
    });
    const r = await window.indexedDB.databases();
    for (var i = 0; i < r.length; i++) {
        window.indexedDB.deleteDatabase(r[i].name);
    }
};

window.ItemSchema = ItemSchema;

window.setupMulti = (deltaNetwork, blobConfigs) => {
    const deltas = {};
    const blobs = {};
    Object.keys(blobConfigs).forEach(key => {
        blobs[key] = createBasicBlobNetwork(blobConfigs[key]);
    });
    const clock = new PersistentClock(localStorageClockPersist('multi'));
    const deltaCreate = (
        data: Data,
        id: string,
    ): { node: string, delta: Delta, stamp: string } => ({
        delta: crdt.deltas.set([], data),
        node: id,
        stamp: clock.get(),
    });
    const client = createMultiClient(
        crdt,
        { tasks: ItemSchema },
        clock,
        makeMultiPersistence(
            'multi-first-second',
            ['tasks'],
            deltaNetwork ? true : false,
            Object.keys(blobs),
            deltaCreate,
        ),
        deltaNetwork
            ? deltaNetwork.type === 'ws'
                ? createWebSocketNetwork(deltaNetwork.url)
                : createPollingNetwork(deltaNetwork.url)
            : null,
        blobs,
    );
    window.client = client;
};

window.setupPolling = port =>
    setup(createPollingNetwork(`http://localhost:${port}/sync`));
window.setupWebSockets = port =>
    setup(createWebSocketNetwork(`ws://localhost:${port}/sync`));
window.setupBlob = port => {
    const client = createBlobClient(
        crdt,
        { tasks: ItemSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeBlobPersistence('local-first', ['tasks']),
        // etag: ?string => Promise<?Blob<Data>>
        // Blob<data> => Promise<string>
        createBasicBlobNetwork(`http://localhost:${port}/blob/stuff`),
        // createPollingNetwork('http://localhost:9900/sync'),
        // createWebSocketNetwork('ws://localhost:9900/sync'),
    );
    console.log('set up blob');
    window.client = client;
};

const setup = makeNetwork => {
    const client = createClient(
        crdt,
        { tasks: ItemSchema },
        new PersistentClock(localStorageClockPersist('test')),
        makeDeltaPersistence('test', ['tasks']),
        makeNetwork,
    );
    console.log('setting up');
    window.client = client;
    console.log('Ok set up');
};
