// @flow

import type {
    Client,
    Collection,
    PeerChange,
    Blob,
    ClockPersist,
    FullPersistence,
    BlobNetworkCreator,
} from '../types';
import { peerTabAwareNetwork } from '../peer-tabs';
import { type Schema } from '@local-first/nested-object-crdt/schema.js';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
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
    clockPersist: ClockPersist,
    persistence: FullPersistence,
    createNetwork: BlobNetworkCreator<Data, SyncStatus>,
): Client<SyncStatus> {
    let clock = clockPersist.get(() => hlc.init(genId(), Date.now()));
    const state: { [key: string]: CollectionState<Data, any> } = {};
    persistence.collections.forEach(id => (state[id] = newCollection()));

    const getStamp = () => {
        clock = hlc.inc(clock, Date.now());
        clockPersist.set(clock);
        return hlc.pack(clock);
    };

    const setClock = (newClock: HLC) => {
        clock = newClock;
        clockPersist.set(clock);
    };

    const recvClock = (newClock: HLC) => {
        clock = hlc.recv(clock, newClock, Date.now());
        clockPersist.set(clock);
    };

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
        sessionId: clock.node,
        setDirty: network.setDirty,
        getStamp,
        getCollection<T>(colid: string) {
            return getCollection(
                colid,
                crdt,
                persistence,
                state[colid],
                getStamp,
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
