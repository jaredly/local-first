#!/usr/bin/env node -r @babel/register
// @flow
import express from 'express';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import type { Schema } from '@local-first/nested-object-crdt/lib/schema.js';
import ws from 'express-ws';
import make, { onMessage, getMessages } from '../fault-tolerant/server';
import type {
    ClientMessage,
    ServerMessage,
    CursorType,
    ServerState,
} from '../fault-tolerant/server';
import { ItemSchema } from '../shared/schema.js';

import setupPersistence from './sqlite-persistence';
import levelup from 'levelup';
import leveldown from 'leveldown';

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

const server = make<Delta, Data>(
    crdt,
    setupPersistence(__dirname + '/.data'),
    (collectionId: string): Schema => {
        return ItemSchema;
    },
);

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

const app = express();
ws(app);
app.use(require('cors')());
app.use(require('body-parser').json());

app.post('/sync', (req, res) => {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    res.json(post(server, req.query.sessionId, req.body));
    // let maxStamp = null;
    // console.log(`sync:messages`, req.body);
    // const acks = req.body
    //     .map(message => onMessage(server, req.query.sessionId, message))
    //     .filter(Boolean);
    // console.log('ack', acks);
    // const messages = getMessages(server, req.query.sessionId);
    // console.log('messags', messages);

    // res.json(acks.concat(messages));
});

const clients = {};

const onWebsocket = <Delta, Data>(
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

app.ws('/sync', function(ws, req) {
    if (!req.query.sessionId) {
        console.log('no sessionid');
        throw new Error('No sessionId');
    }
    onWebsocket(server, clients, req.query.sessionId, ws);
    // clients[req.query.sessionId] = {
    //     send: messages => ws.send(JSON.stringify(messages)),
    // };
    // ws.on('message', data => {
    //     const messages = JSON.parse(data);
    //     const acks = messages
    //         .map(message => onMessage(server, req.query.sessionId, message))
    //         .filter(Boolean);
    //     // messages.forEach(message =>
    //     //     onMessage(server, req.query.sessionId, message),
    //     // );
    //     const response = getMessages(server, req.query.sessionId);

    //     ws.send(JSON.stringify(acks.concat(response)));

    //     Object.keys(clients).forEach(id => {
    //         if (id !== req.query.sessionId) {
    //             const response = getMessages(server, id);
    //             clients[id].send(messages);
    //         }
    //     });
    // });
    // ws.on('close', () => {
    //     delete clients[req.query.sessionId];
    // });
});

app.listen(9900);
console.log('listening on 9900');
