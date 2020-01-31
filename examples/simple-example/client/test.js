// @flow
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { makeNetwork as makePoll } from './poll';
import { makeNetwork as makeWS } from './ws';
import makeClient, * as clientLib from '../fault-tolerant/client';
import * as deltaLib from '../fault-tolerant/delta-client';
import { ItemSchema } from '../shared/schema.js';
import makePersistence from './idb-persistence';

const { BroadcastChannel } = require('broadcast-channel');

window.clientLib = clientLib;
window.ItemSchema = ItemSchema;
window.setupPolling = port => setup(makePoll, `http://localhost:${port}/sync`);
window.setupWebSockets = port => setup(makeWS, `ws://localhost:${port}/sync`);

const setup = (makeNetwork, url) => {
    const persistence = makePersistence('test', ['tasks']);
    const client = makeClient(persistence, crdt, () => {}, ['tasks']);

    const channel = new BroadcastChannel('local-first', {
        webWorkerSupport: false,
    });
    channel.onmessage = msg => {
        console.log('got a message');
        clientLib
            .receiveCrossTabChanges(client, msg)
            .catch(err => console.log('failed', err.message, err.stack));
        console.log('Processed message', JSON.stringify(msg));
    };
    client.listeners.push(colChanges => {
        channel.postMessage(colChanges);
    });
    // Ok so rough plan:
    // - add a `listeners` field to the client state
    // - messages received from the server, as well as deltas generated locally, get sent to listeners
    // - and that should do the trick?
    // - I think...
    // - so you start a broadcast channel, and onmessage you do like "client on local message" or something, no persistance???
    // - no wait I don't even need that.
    // - I can do a general "on change" where it just broadcasts: colname + nodeid, and the other people can fetch from indexeddb.
    // - yeah that sounds fine. listeners is (Array<{colid, nodeid}>) => void or something like that.

    const network = makeNetwork(
        url,
        persistence.getHLC().node,
        (reconnected: boolean) => deltaLib.syncMessages(client, reconnected),
        messages => {
            console.log('Received messages', messages);
            return Promise.all(
                messages.map(message => deltaLib.onMessage(client, message)),
            );
        },
        peerChange => clientLib.receiveCrossTabChanges(client, peerChange),
    );
    client.listeners.push(network.sendCrossTabChanges);
    console.log('setting up');
    client.setDirty = network.sync;
    window.client = client;
    window.network = network;
    console.log('Ok set up');
};
