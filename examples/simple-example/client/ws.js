// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    syncSucceeded,
    debounce,
    type Persistence,
    type ClientState,
    type CRDTImpl,
} from '../fault-tolerant/client';
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

export default function<Delta, Data>(
    persistence: Persistence<Delta, Data>,
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
        if (state.socket) {
            const socket = state.socket;
            syncMessages(client.persistence, client.collections).then(
                messages => {
                    if (messages.length) {
                        socket.send(JSON.stringify(messages));
                    }
                },
            );
        }
    };

    const client = makeClient(persistence, crdt, sessionId, debounce(sync));
    sync();
    return {
        client,
        onConnection: fn => {
            listeners.push(fn);
        },
    };
}
