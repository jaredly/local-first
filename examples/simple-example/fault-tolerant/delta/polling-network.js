// @flow

import type { Client, Collection } from '../types';
import type {
    Persistence,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
} from './types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type ClientMessage, type ServerMessage } from '../server';

type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

import { peerTabAwareSync } from './peer-tabs';
import poller from '../../client/poller';
import backOff from '../../shared/back-off';
import { debounce } from '../debounce';

// Ok the part where we get very specific
const syncFetch = async function<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (
        reconnected: boolean,
    ) => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
) {
    const messages = await getMessages(true);
    console.log('sync:messages', messages);
    // console.log('messages', messages);
    const res = await fetch(`${url}?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
    if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
    }
    const data = await res.json();
    console.log('sync:data', data);
    await onMessages(data);
};

const createPollingNetwork = <Delta, Data>(
    url: string,
): NetworkCreator<Delta, Data, SyncStatus> => (
    sessionId,
    getMessages,
    handleMessages,
    handleCrossTabChanges,
): Network<SyncStatus> => {
    const connectionListeners = [];
    let currentSyncStatus = { status: 'disconnected' };

    const { sendConnectionStatus, sendCrossTabChange, sync } = peerTabAwareSync(
        status => {
            currentSyncStatus = status;
            connectionListeners.forEach(f => f(currentSyncStatus));
        },
        peerChange => {
            handleCrossTabChanges(peerChange).catch(err =>
                console.log('failed', err.message, err.stack),
            );
        },
        () => {
            console.log('Im the leader');
            const poll = poller(
                3 * 1000,
                () =>
                    new Promise(res => {
                        backOff(() =>
                            syncFetch(url, sessionId, getMessages, messages =>
                                handleMessages(messages, sendCrossTabChange),
                            ).then(
                                () => {
                                    currentSyncStatus = { status: 'connected' };
                                    connectionListeners.forEach(f =>
                                        f(currentSyncStatus),
                                    );
                                    res();
                                    return true;
                                },
                                err => {
                                    console.error('Failed to sync');
                                    console.error(err);
                                    currentSyncStatus = {
                                        status: 'disconnected',
                                    };
                                    connectionListeners.forEach(f =>
                                        f(currentSyncStatus),
                                    );
                                    return false;
                                },
                            ),
                        );
                    }),
            );
            poll();
            return debounce(poll);
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

export default createPollingNetwork;
