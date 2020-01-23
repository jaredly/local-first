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

// let sessionId = localStorage.getItem('sessionId');
// if (!sessionId) {
//     sessionId = Math.random()
//         .toString(36)
//         .slice(2);
//     localStorage.setItem('sessionId', sessionId);
// }

// const reconnectingSocket = (url, onOpen, onMessage) => {
//     const state = {
//         socket: new WebSocket(
//             url
//         ),
//         connected: false,
//     }
//     const reconnect = () => {
//         backOff(() => new Promise((res, rej) => {
//             state.socket = new WebSocket(url);
//             state.socket.addEventListener('open', () => {
//                 res();
//                 state.connected = true;
//                 onOpen();
//             });
//             state.socket.addEventListener('close', () => {
//                 state.connected = false;
//                 rej();
//             });
//             state.socket.addEventListener('message', onMessage);
//         }))
//     }
//     state.socket.addEventListener('open', () => {
//         state.connected = true;
//         onOpen();
//     });
//     state.socket.addEventListener('close', () => {
//         state.connected = false;
//     });
//     state.socket.addEventListener('message', onMessage);
//     return state;
// }

export default function<Delta, Data>(
    url: string,
    sessionId: string,
    crdt: CRDTImpl<Delta, Data>,
): ClientState<Delta, Data> {
    let connected = false;
    const onOpen = () => {
        console.log('connected');
        connected = true;
        sync();
    };
    const onClose = () => {
        connected = false;
    };
    const onWsMessage = function({ data }: { data: any }) {
        const messages = JSON.parse(data);
        messages.forEach(message => onMessage(client, message));
    };

    const setupSocket = () => {
        let socket = new WebSocket(
            `ws://localhost:9900/sync?sessionId=${sessionId}`,
        );
        socket.addEventListener('open', onOpen);
        socket.addEventListener('close', onClose);
        socket.addEventListener('message', onWsMessage);
        return socket;
    };

    // const send = message => {
    //     if (!connected) {
    //         console.log('tried to send, but not connected', message);
    //         return false;
    //     }
    //     console.log('sending', message);
    //     message.forEach(message => {
    //         socket.send(JSON.stringify(message));
    //     });
    //     return true;
    // };
    const socket = setupSocket();

    const sync = () => {
        if (connected) {
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
