// @flow

import type { Client } from '../types';
import type {
    ClockPersist,
    MultiPersistence,
    Network,
    NetworkCreator,
    BlobNetworkCreator,
    PersistentClock,
} from '../types';
import { peerTabAwareNetworks } from '../peer-tabs';
import type { HLC } from '../../../hybrid-logical-clock';
import * as hlc from '../../../hybrid-logical-clock';
import { type Schema } from '../../../nested-object-crdt/src/schema.js';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from '../types';
import { updateCacheAndNotify, fullMaxStamp } from '../blob/create-client';
import { type ClientMessage, type ServerMessage } from '../server';

import {
    newCollection,
    getCollection,
    onCrossTabChanges,
    type CRDTImpl,
    type CollectionState,
} from '../shared';

/*

Ok folks, we've got issues with peer-tabs

I'd rather not be waiting for 100s of miliseconds while
we work out whether or not we're the leader tab.

If you're the first tab, then there's a minimum of 300ms before
you can declare yourself the leader .... which allows for race
conditions.

So I think the ideal is:
- on page load, do a request to get all the things you're missing.
- add those in n stuff.
- then do leader election, and whoever wins gets to continue things.

What are the issues that come from two tabs making a request at the same time?
> um if multiple websockets with the same sessionid connect, bad things happen.

but that's it I think. And I can ~prevent that on the server side by hanging up.

.... on further investigation, this isn't the reason my tests were failing.
I think.
So maybe this won't be a big deal?

*/

export const getMessages = async function<Delta, Data>(
    persistence: MultiPersistence,
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    console.log('getting messages');
    const items: Array<?ClientMessage<Delta, Data>> = await Promise.all(
        persistence.collections.map(
            async (
                collection: string,
            ): Promise<?ClientMessage<Delta, Data>> => {
                const deltas = await persistence.deltas(collection);
                const serverCursor = await persistence.getServerCursor(
                    collection,
                );
                if (deltas.length || serverCursor == null || reconnected) {
                    console.log('messages yeah', serverCursor);
                    return {
                        type: 'sync',
                        collection,
                        serverCursor,
                        deltas: deltas.map(({ node, delta }) => ({
                            node,
                            delta,
                        })),
                    };
                } else {
                    console.log('noe messages', deltas, serverCursor);
                }
            },
        ),
    );
    return items.filter(Boolean);
};

export const handleMessages = async function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: MultiPersistence,
    messages: Array<ServerMessage<Delta, Data>>,
    state: { [colid: string]: CollectionState<Data, any> },
    recvClock: HLC => void,
    sendCrossTabChanges: PeerChange => mixed,
) {
    const items: Array<?ClientMessage<Delta, Data>> = await Promise.all(
        messages.map(async (msg): Promise<?ClientMessage<Delta, Data>> => {
            if (msg.type === 'sync') {
                const col = state[msg.collection];

                const changed = {};
                msg.deltas.forEach(delta => {
                    changed[delta.node] = true;
                });

                const deltasWithStamps = msg.deltas.map(delta => ({
                    ...delta,
                    stamp: crdt.deltas.stamp(delta.delta),
                }));

                const changedIds = Object.keys(changed);
                console.log(
                    'applying deltas',
                    msg.serverCursor,
                    msg.deltas.length,
                    msg.deltas,
                );
                if (!msg.serverCursor && !msg.deltas.length) {
                    return;
                }
                const data = await persistence.applyDeltas(
                    msg.collection,
                    deltasWithStamps,
                    msg.serverCursor,
                    (data, delta) => crdt.deltas.apply(data, delta),
                );

                if (col.listeners.length) {
                    console.log('notifying global listeners');
                    const changes = changedIds.map(id => ({
                        id,
                        value: crdt.value(data[id]),
                    }));
                    col.listeners.forEach(listener => {
                        listener(changes);
                    });
                }
                changedIds.forEach(id => {
                    // Only update the cache if the node has already been cached
                    if (state[msg.collection].cache[id] != null) {
                        state[msg.collection].cache[id] = data[id];
                    }
                    if (col.itemListeners[id]) {
                        col.itemListeners[id].forEach(fn =>
                            fn(crdt.value(data[id])),
                        );
                    }
                });

                if (changedIds.length) {
                    console.log(
                        'Broadcasting to client-level listeners',
                        changedIds,
                    );
                    sendCrossTabChanges({
                        col: msg.collection,
                        nodes: changedIds,
                    });
                }

                let maxStamp = null;
                msg.deltas.forEach(delta => {
                    const stamp = crdt.deltas.stamp(delta.delta);
                    if (maxStamp == null || stamp > maxStamp) {
                        maxStamp = stamp;
                    }
                });
                if (maxStamp) {
                    recvClock(hlc.unpack(maxStamp));
                }
                return {
                    type: 'ack',
                    collection: msg.collection,
                    serverCursor: msg.serverCursor,
                };
            } else if (msg.type === 'ack') {
                return persistence.deleteDeltas(msg.collection, msg.deltaStamp);
            }
        }),
    );
    return items.filter(Boolean);
};

function createClient<Delta, Data, SyncStatus>(
    crdt: CRDTImpl<Delta, Data>,
    schemas: { [colid: string]: Schema },
    clock: PersistentClock,
    persistence: MultiPersistence,
    deltaNetwork: ?NetworkCreator<Delta, Data, SyncStatus>,
    blobNetworks: { [serverId: string]: BlobNetworkCreator<Data, SyncStatus> },
): Client<{ [key: string]: SyncStatus }> {
    const state: { [key: string]: CollectionState<Data, any> } = {};
    persistence.collections.forEach(id => (state[id] = newCollection()));

    const allDirty = [];

    const handlePeerChange = (msg: PeerChange) => {
        return onCrossTabChanges(
            crdt,
            persistence,
            state[msg.col],
            msg.col,
            msg.nodes,
        );
    };

    const allNetworks: { [key: string]: Network<SyncStatus> } = {};

    if (blobNetworks[':delta:']) {
        throw new Error(`Can't have a blob network with the id :delta:`);
    }
    if (deltaNetwork) {
        allNetworks[':delta:'] = deltaNetwork(
            clock.now.node,
            fresh => getMessages(persistence, fresh),
            (messages, sendCrossTabChanges) =>
                // $FlowFixMe
                handleMessages(
                    crdt,
                    persistence,
                    messages,
                    state,
                    clock.recv,
                    sendCrossTabChanges,
                ),
        );
    }

    Object.keys(blobNetworks).forEach(serverId => {
        allNetworks[serverId] = blobNetworks[serverId](
            () => persistence.getFull(serverId),
            async (full, etag, sendCrossTabChanges) => {
                const max = fullMaxStamp(crdt, full);
                if (max != null) {
                    clock.recv(hlc.unpack(max));
                }
                const result = await persistence.mergeFull<Delta, Data>(
                    serverId,
                    full,
                    etag,
                    crdt.merge,
                    crdt.deltas.diff,
                    clock.get,
                );
                if (!result) {
                    return null;
                }
                const { merged, changedIds } = result;
                updateCacheAndNotify(
                    state,
                    crdt,
                    changedIds,
                    merged.blob,
                    sendCrossTabChanges,
                );
                return merged;
            },
            (etag, dirtyFlag) =>
                persistence.updateMeta(serverId, etag, dirtyFlag),
        );
    });

    const network = peerTabAwareNetworks(handlePeerChange, allNetworks);

    return {
        sessionId: clock.now.node,
        getStamp: clock.get,
        setDirty: network.setDirty,
        getCollection<T>(colid: string) {
            return getCollection(
                colid,
                crdt,
                persistence,
                state[colid],
                clock.get,
                network.setDirty,
                network.sendCrossTabChanges,
                schemas[colid],
            );
        },
        onSyncStatus(fn) {
            network.onSyncStatus(fn);
        },
        getSyncStatus() {
            return network.getSyncStatus();
        },
    };
}

export default createClient;
