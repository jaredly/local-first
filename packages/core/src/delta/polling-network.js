// @flow

import type {
    Persistence,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
} from '../types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type ClientMessage, type ServerMessage } from '../server';

type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

import { peerTabAwareSync } from '../peer-tabs';
import poller from '../poller';
import backOff from '../back-off';
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
): Network<SyncStatus> => {
    return {
        initial: { status: 'disconnected' },
        createSync: (sendCrossTabChange, updateStatus) => {
            console.log('Im the leader (polling)');
            const poll = poller(
                3 * 1000,
                () =>
                    new Promise(res => {
                        backOff(() =>
                            syncFetch(url, sessionId, getMessages, messages =>
                                handleMessages(messages, sendCrossTabChange),
                            ).then(
                                () => {
                                    updateStatus({ status: 'connected' });
                                    res();
                                    return true;
                                },
                                err => {
                                    console.error('Failed to sync polling');
                                    console.error(err.stack);
                                    updateStatus({
                                        status: 'disconnected',
                                    });
                                    return false;
                                },
                            ),
                        );
                    }),
            );
            poll();
            return debounce(poll);
        },
    };
};

export default createPollingNetwork;
