// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    syncFailed,
    syncSucceeded,
    debounce,
    type ClientState,
} from './client';
import backOff from './back-off';
import type { CRDTImpl } from './client';

const reconnectingSocket = (url, onOpen, onMessage: string => void) => {
    const state: { socket: ?WebSocket } = {
        socket: null,
    };
    const reconnect = () => {
        state.socket = null;
        backOff(
            () =>
                new Promise((res, rej) => {
                    const socket = new WebSocket(url);
                    let opened = false;
                    socket.addEventListener('open', () => {
                        state.socket = socket;
                        opened = true;
                        res(true);
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
        );
    };
    reconnect();
    return state;
};

export default function<Delta, Data>(
    url: string,
    sessionId: string,
    crdt: CRDTImpl<Delta, Data>,
): ClientState<Delta, Data> {
    const state = reconnectingSocket(
        `ws://localhost:9900/sync?sessionId=${sessionId}`,
        () => sync(),
        msg => {
            const messages = JSON.parse(msg);
            messages.forEach(message => onMessage(client, message));
        },
    );

    const sync = () => {
        if (state.socket) {
            const socket = state.socket;
            const messages = syncMessages(client.collections);
            if (messages.length) {
                socket.send(JSON.stringify(messages));
            }
        }
    };

    const client = makeClient(crdt, sessionId, debounce(sync));
    sync();
    return client;
}
