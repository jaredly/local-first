// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { makeNetwork as makePoll } from './poll';
import { makeNetwork as makeWS } from './ws';
// import makeClient, * as clientLib from '../fault-tolerant/client';
import * as deltaLib from '../fault-tolerant/delta-client';
import { ItemSchema } from '../shared/schema.js';
import makePersistence from './idb-persistence';

import createClient from '../fault-tolerant/delta/create-client';
import makeDeltaPersistence from '../fault-tolerant/delta/idb-persistence';
import createPollingNetwork from '../fault-tolerant/delta/polling-network';
import createWebSocketNetwork from '../fault-tolerant/delta/websocket-network';

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

const setup = makeNetwork => {
    const client = createClient(
        crdt,
        clockPersist('test'),
        makeDeltaPersistence('test', ['tasks']),
        makeNetwork,
    );
    console.log('setting up');
    window.client = client;
    console.log('Ok set up');
};
