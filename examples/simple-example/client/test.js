// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
// import { makeNetwork as makePoll } from '../shared/poll';
// import { makeNetwork as makeWS } from './ws';
// import makeClient, * as clientLib from '../fault-tolerant/client';
// import * as deltaLib from '../fault-tolerant/delta-client';
import { ItemSchema } from '../shared/schema.js';

import createClient from '../fault-tolerant/delta/create-client';
import makeDeltaPersistence from '../fault-tolerant/delta/idb-persistence';
import createPollingNetwork from '../fault-tolerant/delta/polling-network';
import createWebSocketNetwork from '../fault-tolerant/delta/websocket-network';

import createBlobClient from '../fault-tolerant/blob/create-client';
import makeBlobPersistence from '../fault-tolerant/blob/idb-persistence';
import createBasicBlobNetwork from '../fault-tolerant/blob/basic-network';

const clockPersist = (key: string) => ({
    get(init) {
        const raw = localStorage.getItem(key);
        if (!raw) {
            const res = init();
            localStorage.setItem(key, hlc.pack(res));
            return res;
        }
        return hlc.unpack(raw);
    },
    set(clock: HLC) {
        localStorage.setItem(key, hlc.pack(clock));
    },
});

// window.clientLib = clientLib;
window.ItemSchema = ItemSchema;
window.setupPolling = port =>
    setup(createPollingNetwork(`http://localhost:${port}/sync`));
window.setupWebSockets = port =>
    setup(createWebSocketNetwork(`ws://localhost:${port}/sync`));
window.setupBlob = port => {
    const client = createBlobClient(
        crdt,
        { tasks: ItemSchema },
        clockPersist('local-first'),
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
        clockPersist('test'),
        makeDeltaPersistence('test', ['tasks']),
        makeNetwork,
    );
    console.log('setting up');
    window.client = client;
    console.log('Ok set up');
};
