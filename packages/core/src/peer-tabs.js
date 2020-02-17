// @flow

import type {
    Persistence,
    OldNetwork,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
} from './types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from './types';

export const peerTabAwareNetworks = function<SyncStatus>(
    handleCrossTabChanges: PeerChange => mixed,
    networks: { [key: string]: Network<SyncStatus> },
): OldNetwork<{ [key: string]: SyncStatus }> {
    const connectionListeners = [];
    let currentSyncStatus = {};
    Object.keys(networks).forEach(
        key => (currentSyncStatus[key] = networks[key].initial),
    );

    const { sendConnectionStatus, sendCrossTabChange, sync } = peerTabAwareSync(
        status => {
            currentSyncStatus = status;
            connectionListeners.forEach(f => f(currentSyncStatus));
        },
        peerChange => {
            console.log('received peer change');
            handleCrossTabChanges(peerChange);
        },
        // Create the thing.
        sendCrossTabChange => {
            const syncs = {};
            Object.keys(networks).forEach(key => {
                syncs[key] = networks[key].createSync(
                    sendCrossTabChange,
                    status => {
                        currentSyncStatus[key] = status;
                        connectionListeners.forEach(f => f(currentSyncStatus));
                    },
                    () => {
                        Object.keys(syncs).forEach(k => {
                            if (k !== key) {
                                syncs[k](true);
                            }
                        });
                    },
                );
            });
            return () => {
                Object.keys(syncs).forEach(k => {
                    syncs[k]();
                });
            };
        },
    );

    return {
        setDirty: sync,
        onSyncStatus: fn => {
            connectionListeners.push(fn);
        },
        getSyncStatus() {
            return currentSyncStatus;
        },
        sendCrossTabChanges(peerChange) {
            sendCrossTabChange(peerChange);
        },
    };
};

export const peerTabAwareNetwork = function<SyncStatus>(
    handleCrossTabChanges: PeerChange => mixed,
    network: Network<SyncStatus>,
): OldNetwork<SyncStatus> {
    const connectionListeners = [];
    let currentSyncStatus = network.initial;

    const { sendConnectionStatus, sendCrossTabChange, sync } = peerTabAwareSync(
        status => {
            currentSyncStatus = status;
            connectionListeners.forEach(f => f(currentSyncStatus));
        },
        peerChange => {
            console.log('received peer change');
            handleCrossTabChanges(peerChange);
        },
        sendCrossTabChange => {
            const sync = network.createSync(
                sendCrossTabChange,
                status => {
                    currentSyncStatus = status;
                    connectionListeners.forEach(f => f(currentSyncStatus));
                },
                () => {
                    // do nothing
                },
            );
            return () => sync(false);
        },
    );

    return {
        setDirty: sync,
        onSyncStatus: fn => {
            connectionListeners.push(fn);
        },
        getSyncStatus() {
            return currentSyncStatus;
        },
        sendCrossTabChanges(peerChange) {
            sendCrossTabChange(peerChange);
        },
    };
};

export const peerTabAwareSync = function<SyncStatus>(
    onStatus: SyncStatus => void,
    handleCrossTabChange: PeerChange => void,
    makeLeaderSync: (sendCrossTabChanges: (PeerChange) => void) => () => void,
) {
    const {
        BroadcastChannel,
        createLeaderElection,
    } = require('broadcast-channel');
    const channel = new BroadcastChannel('local-first', {
        webWorkerSupport: false,
    });

    const originalSync = () => {
        channel.postMessage({ type: 'sync' });
    };

    channel.onmessage = (
        msg:
            | { type: 'change', peerChange: PeerChange }
            | { type: 'sync' }
            | { type: 'status', status: SyncStatus },
    ) => {
        console.log('got a peer message', msg.type);
        if (msg.type === 'sync' && sync !== originalSync) {
            sync();
        } else if (msg.type === 'change') {
            handleCrossTabChange(msg.peerChange);
        } else if (msg.type === 'status') {
            onStatus(msg.status);
        }
        console.log('Processed message', msg);
    };

    const sendCrossTabChange = (change: PeerChange) => {
        console.log('Sending changes', change);
        channel.postMessage({ type: 'change', peerChange: change });
    };

    const elector = createLeaderElection(channel);
    let sync = originalSync;
    elector.awaitLeadership().then(() => {
        sync = makeLeaderSync(sendCrossTabChange);
    });

    return {
        sendConnectionStatus: (status: SyncStatus) => {
            channel.postMessage({ type: 'status', status });
        },
        sendCrossTabChange,
        sync: () => sync(),
    };
};
