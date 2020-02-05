// @flow

import type { Client, Collection } from '../types';
import type {
    ClockPersist,
    FullPersistence,
    BlobNetworkCreator,
} from '../delta/types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from '../client';

import {
    newCollection,
    getCollection,
    onCrossTabChanges,
    type CRDTImpl,
    type CollectionState,
} from '../delta/shared';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

import { type ClientMessage, type ServerMessage } from '../server';

function createClient<Delta, Data, SyncStatus>(
    crdt: CRDTImpl<Delta, Data>,
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

    const network = createNetwork(
        // Hmm maybe I'm keeping network & persistence at an artificial distance
        // I could just be passing persistence to the network creator...
        // As long as the crdt was baked into the persistence,
        // which doesn't seem terrible.
        () => persistence.getFull(),
        async (full, etag, sendCrossTabChanges) => {
            const { merged, changedIds } = await persistence.mergeFull(
                full,
                etag,
                crdt.merge,
            );
            Object.keys(changedIds).forEach(colid => {
                const col = state[colid];
                const data = merged.blob[colid];
                if (col.listeners.length) {
                    const changes = changedIds[colid].map(id => ({
                        id,
                        value: crdt.value(data[id]),
                    }));
                    col.listeners.forEach(listener => {
                        listener(changes);
                    });
                }
                changedIds[colid].forEach(id => {
                    // Only update the cache if the node has already been cached
                    if (state[colid].cache[id]) {
                        state[colid].cache[id] = data[id];
                    }
                    if (col.itemListeners[id]) {
                        col.itemListeners[id].forEach(fn =>
                            fn(crdt.value(data[id])),
                        );
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
            return merged;
        },
        persistence.updateMeta,
        (msg: PeerChange) => {
            return onCrossTabChanges(
                crdt,
                persistence,
                state[msg.col],
                msg.col,
                msg.nodes,
            );
        },
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
