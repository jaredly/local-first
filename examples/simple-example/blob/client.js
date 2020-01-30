// @flow

import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
// import { makeNetwork } from './poll';
import { makeNetwork } from './ws';
import makeClient, {
    getStamp,
    receiveCrossTabChanges,
    getCollection,
    type ClientState,
    type CursorType,
} from '../fault-tolerant/client';
import { syncMessages, onMessage } from '../fault-tolerant/delta-client';
import { ItemSchema } from '../shared/schema.js';
import makePersistence from '../client/idb-persistence';

// const syncFetch = async function<Delta, Data>(
//     url: string,
// ) {
//     const messages = await getMessages(true);
//     console.log('sync:messages', messages);
//     // console.log('messages', messages);
//     const res = await fetch(`${url}?sessionId=${sessionId}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(messages),
//     });
//     if (res.status !== 200) {
//         throw new Error(`Unexpected status ${res.status}`);
//     }
//     const data = await res.json();
//     console.log('sync:data', data);
//     await onMessages(data);
// };

const setup = colids => {
    const persistence = makePersistence();
    const client = makeClient(persistence, crdt, () => {}, ['tasks'], 'full');
    const url = `http://localhost:7898`;
    // const network = makeNetwork(
    //     // 'http://localhost:9900/sync',
    //     'ws://localhost:9104/sync',
    //     persistence.getHLC().node,
    //     reconnected =>
    //         syncMessages(client, reconnected),
    //     messages =>
    //         Promise.all(messages.map(message => onMessage(client, message))),
    //     peerChange => receiveCrossTabChanges(client, peerChange),
    // );
    const fullSync = async client => {
        const server = await fetch(`${url}/${colids.join(',')}`);
        if (server.status === 404) {
            const collections = {};
            await fetch(`${url}/${colids}`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify(await client.persistence.getFull(colids)),
            });
        } else {
            // Ok to update, we'll want to do this in a transaction w/ idb.
            await client.persistence.updateFull(await server.json());
        }
    };
    // client.listeners.push(network.sendCrossTabChanges);
    client.setDirty = () => {
        fullSync(client);
    };
    return { client, onConnection: network.onConnection };
};
