// @flow
import type { Delta, CRDT as Data } from '../nested-object-crdt';
import type { Schema } from '../nested-object-crdt/src/schema.js';
import make, { onMessage, getMessages } from '../core/src/server';
import type {
    ClientMessage,
    ServerMessage,
    CursorType,
    ServerState,
} from '../core/src/server';

export const handleMessages = function<Delta, Data>(
    server: ServerState<Delta, Data>,
    sessionId: string,
    respond: (Array<ServerMessage<Delta, Data>>) => void,
    messages: Array<ClientMessage<Delta, Data>>,
) {
    const acks = messages
        .map(message => onMessage(server, sessionId, message))
        .filter(Boolean);
    const response = getMessages(server, sessionId);

    respond(acks.concat(response));
};

export const broadcast = function<Delta, Data>(
    server: ServerState<Delta, Data>,
    clients: {
        [key: string]: { send: (Array<ServerMessage<Delta, Data>>) => void },
    },
    sessionId: string,
) {
    Object.keys(clients).forEach(id => {
        if (id !== sessionId) {
            const response = getMessages(server, id);
            clients[id].send(response);
        }
    });
};

export const onWebsocket = <Delta, Data>(
    server: ServerState<Delta, Data>,
    clients: {
        [key: string]: { send: (Array<ServerMessage<Delta, Data>>) => void },
    },
    sessionId: string,
    ws: { send: string => void, on: (string, (string) => void) => void },
) => {
    clients[sessionId] = {
        send: messages => ws.send(JSON.stringify(messages)),
    };
    ws.on('message', data => {
        handleMessages(
            server,
            sessionId,
            data => ws.send(JSON.stringify(data)),
            JSON.parse(data),
        );
        broadcast(server, clients, sessionId);
    });
    ws.on('close', () => {
        delete clients[sessionId];
    });
};
