// @flow

import type {
    Client,
    Collection,
    PeerChange,
    Blob,
    PersistentClock,
    FullPersistence,
    BlobNetworkCreator,
} from '../types';
import { peerTabAwareNetwork } from '../peer-tabs';
import { type Schema } from '../../../packages/nested-object-crdt/src/schema.js';
import * as hlc from '../../../packages/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';

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

export const fullMaxStamp = function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    full: Blob<Data>,
) {
    let maxStamp = null;
    Object.keys(full).forEach(colid => {
        Object.keys(full[colid]).forEach(key => {
            const latest = crdt.maxStamp(full[colid][key]);
            if (latest && (!maxStamp || latest > maxStamp)) {
                maxStamp = latest;
            }
        });
    });
    return maxStamp;
};

export const updateCacheAndNotify = function<Delta, Data>(
    state: { [key: string]: CollectionState<Data, any> },
    crdt: CRDTImpl<Delta, Data>,
    changedIds: { [key: string]: Array<string> },
    blob: Blob<Data>,
    sendCrossTabChanges: PeerChange => mixed,
) {
    Object.keys(changedIds).forEach(colid => {
        const col = state[colid];
        const data = blob[colid];
        if (col.listeners.length) {
            const changes = changedIds[colid].map(id => ({
                id,
                value: crdt.value(data[id]),
            }));
            changedIds[colid].forEach(id => {
                state[colid].cache[id] = data[id];
            });
            col.listeners.forEach(listener => {
                listener(changes);
            });
        }
        changedIds[colid].forEach(id => {
            // Only update the cache if the node has already been cached
            // Umm is this necessary though?
            if (state[colid].cache[id] || col.itemListeners[id]) {
                state[colid].cache[id] = data[id];
            }
            if (col.itemListeners[id]) {
                col.itemListeners[id].forEach(fn => fn(crdt.value(data[id])));
            }
        });

        if (changedIds[colid].length) {
            console.log(
                'Broadcasting to client-level listeners',
                changedIds[colid],
            );
            sendCrossTabChanges({
                col: colid,
                nodes: changedIds[colid],
            });
        }
    });
};

function createClient<Delta, Data, SyncStatus>(
    crdt: CRDTImpl<Delta, Data>,
    schemas: { [colid: string]: Schema },
    clock: PersistentClock,
    persistence: FullPersistence,
    createNetwork: BlobNetworkCreator<Data, SyncStatus>,
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
            persistence.getFull,
            async (full, etag, sendCrossTabChanges) => {
                const max = fullMaxStamp(crdt, full);
                if (max) {
                    clock.recv(max);
                }
                const result = await persistence.mergeFull<Data>(
                    full,
                    etag,
                    crdt.merge,
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
            persistence.updateMeta,
        ),
    );

    return {
        sessionId: clock.now.node,
        setDirty: network.setDirty,
        getStamp: clock.get,
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
