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

// const doThings = (persistence, url, crdt) => {
//     const client = makeClient(persistence, crdt, () => {});
//     const network = makeNetwork(
//         url,
//         persistence.getHLC().node,
//         () => syncMessages(client.persistence, client.collections),
//         messages => messages.forEach(message => onMessage(client, message)),
//     );
//     client.setDirty = network.sync;
// };

export function makeNetwork<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (
        reconnected: boolean,
    ) => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
): {
    sync: () => void,
    onConnection: ((boolean) => void) => void,
} {
    const listeners = [];
    const state = reconnectingSocket(
        `${url}?sessionId=${sessionId}`,
        () => sync(true),
        msg => {
            const messages = JSON.parse(msg);
            onMessages(messages);
        },
        listeners,
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

    // sync();
    return {
        sync,
        onConnection: fn => {
            listeners.push(fn);
        },
    };
}
