#!/usr/bin/env node -r @babel/register
// @flow
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import type { Schema } from '@local-first/nested-object-crdt/lib/schema.js';
import make, { onMessage, getMessages } from '../fault-tolerant/server';
import type {
    ClientMessage,
    ServerMessage,
    CursorType,
    ServerState,
} from '../fault-tolerant/server';
import { ItemSchema } from '../shared/schema.js';

import levelup from 'levelup';
import leveldown from 'leveldown';
import setupPersistence from './sqlite-persistence';

const loadAll = (
    stream,
    parse = false,
): Promise<Array<{ key: string, value: string }>> => {
    return new Promise((res, rej) => {
        const items = [];
        stream
            .on('data', data => items.push(data))
            .on('error', err => rej(err))
            .on('close', () => res(items))
            .on('end', () => res(items));
    });
};

const toObj = (array, key, value) => {
    const obj = {};
    array.forEach(item => (obj[key(item)] = value(item)));
    return obj;
};

export const makeServer = () =>
    make<Delta, Data>(crdt, setupPersistence(__dirname + '/.data'), (
        collectionId /*: string*/,
    ) /*: Schema*/ => {
        return ItemSchema;
    });

export const post = <Delta, Data>(
    server: ServerState<Delta, Data>,
    sessionId: string,
    messages: Array<ClientMessage<Delta, Data>>,
): Array<ServerMessage<Delta, Data>> => {
    let maxStamp = null;
    console.log(`sync:messages`, messages);
    const acks = messages
        .map(message => onMessage(server, sessionId, message))
        .filter(Boolean);
    console.log('ack', acks);
    const responses = getMessages(server, sessionId);
    console.log('messags', responses);
    return acks.concat(responses);
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
        const messages = JSON.parse(data);
        const acks = messages
            .map(message => onMessage(server, sessionId, message))
            .filter(Boolean);
        // messages.forEach(message =>
        //     onMessage(server, sessionId, message),
        // );
        const response = getMessages(server, sessionId);

        ws.send(JSON.stringify(acks.concat(response)));

        Object.keys(clients).forEach(id => {
            if (id !== sessionId) {
                const response = getMessages(server, id);
                clients[id].send(messages);
            }
        });
    });
    ws.on('close', () => {
        delete clients[sessionId];
    });
};
