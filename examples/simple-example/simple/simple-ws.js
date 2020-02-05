// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    syncFailed,
    syncSucceeded,
    debounce,
    dump,
    inflate,
    type ClientState,
} from './client';
import backOff from '../shared/back-off';
import type { CRDTImpl } from '../simple/client';

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
            1.0,
        );
    };
    reconnect();
    return state;
};

const storageKey = `simple-example:data`;

export default function<Delta, Data>(
    url: string,
    sessionId: string,
    crdt: CRDTImpl<Delta, Data>,
): {
    client: ClientState<Delta, Data>,
    onConnection: ((boolean) => void) => void,
} {
    const listeners = [];
    const state = reconnectingSocket(
        `${url}?sessionId=${sessionId}`,
        () => sync(),
        msg => {
            const messages = JSON.parse(msg);
            messages.forEach(message => onMessage(client, message));
        },
        listeners,
    );

    const sync = () => {
        localStorage.setItem(
            storageKey,
            JSON.stringify(dump(client.collections)),
        );
        if (state.socket) {
            const socket = state.socket;
            const messages = syncMessages(client.collections);
            if (messages.length) {
                socket.send(JSON.stringify(messages));
            }
        }
    };

    const client = makeClient(crdt, sessionId, debounce(sync));
    const storedRaw = localStorage.getItem(storageKey);
    if (storedRaw) {
        const data = JSON.parse(storedRaw);
        inflate(sessionId, client.collections, data);
    }
    sync();
    return {
        client,
        onConnection: fn => {
            listeners.push(fn);
        },
    };
}
