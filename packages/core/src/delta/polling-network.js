// @flow

import type {
    Persistence,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
    PeerChange,
} from '../types';
import type { HLC } from '../../../hybrid-logical-clock';
import * as hlc from '../../../hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';
import { type ClientMessage, type ServerMessage } from '../server';

export type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

import poller from '../poller';
import backOff from '../back-off';
import { debounce } from '../debounce';

const addParams = (url, params) => url + (url.includes('?') ? '&' : '?') + params;

// Ok the part where we get very specific
const syncFetch = async function<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (reconnected: boolean) => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
) {
    const messages = await getMessages(true);
    console.log('sync:messages', messages);
    // console.log('messages', messages);
    const res = await fetch(addParams(url, `sessionId=${sessionId}`), {
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

export const doSync = <Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (reconnected: boolean) => Promise<Array<ClientMessage<Delta, Data>>>,
    handleMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
) => {
    return syncFetch(url, sessionId, getMessages, handleMessages).then(
        () => {
            return true;
        },
        err => {
            console.error('Failed to sync polling');
            console.error(err.stack);
            return false;
        },
    );
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
            const handle = messages => handleMessages(messages, sendCrossTabChange);
            console.log('Im the leader (polling)');
            const poll = poller(
                3 * 1000,
                () =>
                    new Promise(res => {
                        backOff(() => {
                            return doSync(url, sessionId, getMessages, handle).then(success => {
                                if (success) {
                                    updateStatus({ status: 'connected' });
                                    res();
                                } else {
                                    updateStatus({
                                        status: 'disconnected',
                                    });
                                }
                                return success;
                            });
                        });
                    }),
            );
            // start polling
            poll();
            return debounce(poll);
        },
    };
};

export default createPollingNetwork;
