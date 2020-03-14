// @flow

import type { Client } from '../types';
import type {
    Persistence,
    OldNetwork,
    Network,
    PersistentClock,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
} from '../types';
import { peerTabAwareNetwork } from '../peer-tabs';
import type { HLC } from '../../../hybrid-logical-clock';
import * as hlc from '../../../hybrid-logical-clock';
import { type Schema } from '../../../nested-object-crdt/src/schema.js';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from '../types';

import {
    newCollection,
    getCollection,
    onCrossTabChanges,
    type CRDTImpl,
    type CollectionState,
} from '../shared';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

import { type ClientMessage, type ServerMessage } from '../server';
export const getMessages = function<Delta, Data>(
    persistence: DeltaPersistence,
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    return Promise.all(
        persistence.collections.map(
            async (
                collection: string,
            ): Promise<?ClientMessage<Delta, Data>> => {
                const deltas = await persistence.deltas(collection);
                const serverCursor = await persistence.getServerCursor(
                    collection,
                );
                if (deltas.length || !serverCursor || reconnected) {
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
                }
            },
        ),
    ).then(a => a.filter(Boolean));
};

export const handleMessages = async function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: DeltaPersistence,
    messages: Array<ServerMessage<Delta, Data>>,
    state: { [colid: string]: CollectionState<Data, any> },
    recvClock: HLC => void,
    sendCrossTabChanges: PeerChange => mixed,
) {
    let hasChanged = false;
    await Promise.all(
        messages.map(async msg => {
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
                console.log('applying deltas', msg.serverCursor);
                const data = await persistence.applyDeltas(
                    msg.collection,
                    deltasWithStamps,
                    msg.serverCursor,
                    (data, delta) => crdt.deltas.apply(data, delta),
                );

                if (col.listeners.length) {
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
                    if (state[msg.collection].cache[id]) {
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
                    hasChanged = true;
                }

                let maxStamp = null;
                msg.deltas.forEach(delta => {
                    const stamp = crdt.deltas.stamp(delta.delta);
                    if (!maxStamp || stamp > maxStamp) {
                        maxStamp = stamp;
                    }
                });
                if (maxStamp) {
                    recvClock(hlc.unpack(maxStamp));
                }
            } else if (msg.type === 'ack') {
                return persistence.deleteDeltas(msg.collection, msg.deltaStamp);
            }
        }),
    );
    return hasChanged;
};

function createClient<Delta, Data, SyncStatus>(
    crdt: CRDTImpl<Delta, Data>,
    schemas: { [colid: string]: Schema },
    clock: PersistentClock,
    persistence: DeltaPersistence,
    createNetwork: NetworkCreator<Delta, Data, SyncStatus>,
): Client<SyncStatus> {
    const state: { [key: string]: CollectionState<Data, any> } = {};
    persistence.collections.forEach(id => (state[id] = newCollection()));

    const network = peerTabAwareNetwork(
        (msg: PeerChange) => {
            return onCrossTabChanges(
                crdt,
                persistence,
                state[msg.col],
                msg.col,
                msg.nodes,
            );
        },
        createNetwork(
            clock.now.node,
            fresh => getMessages(persistence, fresh),
            (messages, sendCrossTabChanges) =>
                handleMessages(
                    crdt,
                    persistence,
                    messages,
                    state,
                    clock.recv,
                    sendCrossTabChanges,
                ),
        ),
    );

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
