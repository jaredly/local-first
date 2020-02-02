// @flow

import type { Client, Collection } from '../types';
import type {
    Persistence,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
} from './types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from '../client';

export const peerTabAwareSync = function<SyncStatus>(
    onStatus: SyncStatus => void,
    handleCrossTabChange: PeerChange => void,
    makeLeaderSync: () => () => void,
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
        msg: { type: 'change', peerChange: PeerChange } | { type: 'sync' },
    ) => {
        console.log('got a message');
        if (msg.type === 'sync' && sync !== originalSync) {
            sync();
        } else if (msg.type === 'change') {
            handleCrossTabChange(msg.peerChange);
        }
        console.log('Processed message', msg);
    };

    const elector = createLeaderElection(channel);
    let sync = originalSync;
    elector.awaitLeadership().then(() => {
        sync = makeLeaderSync();
    });

    return {
        sendConnectionStatus: (status: SyncStatus) => {},
        sendCrossTabChange: (change: PeerChange) => {},
        sync: () => sync(),
    };
};
