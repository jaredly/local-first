// @flow
import { type PeerChange } from '../fault-tolerant/client';
import { debounce } from '../fault-tolerant/debounce';
import {
    type ClientMessage,
    type ServerMessage,
} from '../fault-tolerant/server';
import type { Persistence } from '../fault-tolerant/types.js';
import backOff from '../shared/back-off';
import poller from './poller';

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

export function makeNetwork<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (
        reconnected: boolean,
    ) => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
    onCrossTabChanges: PeerChange => Promise<void>,
): {
    sync: () => void,
    onConnection: ((boolean) => void) => void,
    sendCrossTabChanges: PeerChange => void,
} {
    const listeners = [];

    const {
        BroadcastChannel,
        createLeaderElection,
    } = require('broadcast-channel');
    const channel = new BroadcastChannel('local-first', {
        webWorkerSupport: false,
    });

    channel.onmessage = msg => {
        console.log('got a message');
        onCrossTabChanges(msg).catch(err =>
            console.log('failed', err.message, err.stack),
        );
        console.log('Processed message', JSON.stringify(msg));
    };

    const elector = createLeaderElection(channel);
    let sync = () => {};
    elector.awaitLeadership().then(() => {
        console.log('Im the leader');
        const poll = poller(
            3 * 1000,
            () =>
                new Promise(res => {
                    backOff(() =>
                        syncFetch(url, sessionId, getMessages, onMessages).then(
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
        sync = debounce(poll);
    });

    return {
        onConnection: fn => {
            listeners.push(fn);
        },
        sync: () => sync(),
        sendCrossTabChanges: peerChange => {
            channel.postMessage(peerChange);
        },
    };
}
