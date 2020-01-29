// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    debounce,
    type ClientState,
    type CRDTImpl,
} from '../fault-tolerant/client';
import {
    type ClientMessage,
    type ServerMessage,
} from '../fault-tolerant/server';
import type { Persistence } from '../fault-tolerant/clientTypes.js';
import backOff from '../shared/back-off';
import poller from './poller';

const sync = async function<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: () => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
) {
    const messages = await getMessages();
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

export function makeNetwork<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: () => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
): {
    sync: () => void,
    onConnection: ((boolean) => void) => void,
} {
    const listeners = [];
    const poll = poller(
        3 * 1000,
        () =>
            new Promise(res => {
                backOff(() =>
                    sync(url, sessionId, getMessages, onMessages).then(
                        () => {
                            listeners.forEach(f => f(true));
                            res();
                            return true;
                        },
                        err => {
                            console.error('Failed to sync');
                            console.error(err);
                            listeners.forEach(f => f(false));
                            return false;
                        },
                    ),
                );
            }),
    );

    poll();
    return {
        onConnection: fn => {
            listeners.push(fn);
        },
        sync: debounce(poll),
    };
}
