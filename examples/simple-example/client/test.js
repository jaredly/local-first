// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { makeNetwork as makePoll } from './poll';
import { makeNetwork as makeWS } from './ws';
import makeClient, * as clientLib from '../fault-tolerant/client';
import { ItemSchema } from '../shared/schema.js';
import makePersistence from './idb-persistence';

window.clientLib = clientLib;
window.ItemSchema = ItemSchema;
window.setupPolling = port => setup(makePoll, `http://localhost:${port}/sync`);
window.setupWebSockets = port => setup(makeWS, `ws://localhost:${port}/sync`);

const setup = (makeNetwork, url) => {
    const persistence = makePersistence();
    const client = makeClient(persistence, crdt, () => {}, ['tasks']);
    const network = makeNetwork(
        url,
        persistence.getHLC().node,
        (reconnected: boolean) =>
            clientLib.syncMessages(
                client.persistence,
                client.collections,
                reconnected,
            ),
        messages => {
            console.log('Received messages', messages);
            return Promise.all(
                messages.map(message => clientLib.onMessage(client, message)),
            );
        },
    );
    console.log('setting up');
    client.setDirty = network.sync;
    window.client = client;
    window.network = network;
    console.log('Ok set up');
};
