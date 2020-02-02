// @flow
import { type PeerChange } from '../client';
import { type ClientMessage, type ServerMessage } from '../server';
import type { Network, NetworkCreator } from './types.js';
import backOff from '../../shared/back-off';
import { peerTabAwareSync } from './peer-tabs';

const reconnectingSocket = (
    url,
    onOpen,
    onMessage: string => void,
    listeners: Array<(SyncStatus) => void>,
) => {
    const state: { socket: ?WebSocket } = {
        socket: null,
    };
    const reconnect = () => {
        state.socket = null;
        listeners.forEach(f => f({ status: 'disconnected' }));
        backOff(
            () =>
                new Promise((res, rej) => {
                    const socket = new WebSocket(url);
                    let opened = false;
                    socket.addEventListener('open', () => {
                        state.socket = socket;
                        opened = true;
                        res(true);
                        listeners.forEach(f => f({ status: 'connected' }));
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

type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

const createWebSocketNetwork = <Delta, Data>(
    url: string,
): NetworkCreator<Delta, Data, SyncStatus> => (
    sessionId: string,
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
            const state = reconnectingSocket(
                `${url}?sessionId=${sessionId}`,
                () => sync(true),
                msg => {
                    const messages = JSON.parse(msg);
                    handleMessages(messages, sendCrossTabChange);
                },
                connectionListeners,
            );

            const sync = (reconnected: boolean = false) => {
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
            return sync;
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

export default createWebSocketNetwork;
