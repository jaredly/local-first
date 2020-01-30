// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    debounce,
    receiveCrossTabChanges,
    type ClientState,
    type CRDTImpl,
    type PeerChange,
} from '../fault-tolerant/client';
import {
    type ClientMessage,
    type ServerMessage,
} from '../fault-tolerant/server';
import type { Persistence } from '../fault-tolerant/clientTypes.js';
import backOff from '../shared/back-off';

const reconnectingSocket = (
    url,
    onOpen,
    onMessage: string => void,
    listeners: Array<(boolean) => void>,
) => {
    const state: { socket: ?WebSocket } = {
        socket: null,
    };
    const reconnect = () => {
        state.socket = null;
        listeners.forEach(f => f(false));
        backOff(
            () =>
                new Promise((res, rej) => {
                    const socket = new WebSocket(url);
                    let opened = false;
                    socket.addEventListener('open', () => {
                        state.socket = socket;
                        opened = true;
                        res(true);
                        listeners.forEach(f => f(true));
                        onOpen();
                    });
                    socket.addEventListener('close', () => {
                        if (opened) {
                            reconnect();
                        } else {
                            res(false);
                        }
                    });
                    socket.addEventListener(
                        'message',
                        ({ data }: { data: any }) => onMessage(data),
                    );
                }),
            500,
            1.5,
        );
    };
    reconnect();
    return state;
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
        if (msg.type === 'sync' && sync != followerSync) {
            // console.log('got peer sync');
            sync();
        } else if (msg.type === 'change') {
            // console.log('got a message');
            onCrossTabChanges(msg.change).catch(err =>
                console.error(
                    'failed to process cross tab changes',
                    err.message,
                    err.stack,
                ),
            );
            // console.log('Processed message', JSON.stringify(msg.change));
        }
    };

    const elector = createLeaderElection(channel);
    const followerSync = _ignored => {
        channel.postMessage({ type: 'sync' });
    };
    let sync = followerSync;
    elector.awaitLeadership().then(() => {
        console.log('Im the leader');
        const state = reconnectingSocket(
            `${url}?sessionId=${sessionId}`,
            () => sync(true),
            msg => {
                const messages = JSON.parse(msg);
                onMessages(messages);
            },
            listeners,
        );

        sync = (reconnected: boolean = false) => {
            if (state.socket) {
                const socket = state.socket;
                getMessages(reconnected).then(
                    messages => {
                        if (messages.length) {
                            socket.send(JSON.stringify(messages));
                        } else {
                            console.log('nothing to sync here');
                        }
                    },
                    err => {
                        console.error('Failed to sync messages folks');
                        console.error(err);
                    },
                );
            } else {
                console.log('but no socket');
            }
        };
    });

    // sync();
    return {
        sync: () => sync(false),
        onConnection: fn => {
            listeners.push(fn);
        },
        sendCrossTabChanges: peerChange => {
            console.log('sending cross tab');
            channel.postMessage({ type: 'change', change: peerChange });
        },
    };
}
