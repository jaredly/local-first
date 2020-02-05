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

import path from 'path';
import fs from 'fs';
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

export const makeServer = (dataPath: string) =>
    make<Delta, Data>(crdt, setupPersistence(dataPath), (
        collectionId /*: string*/,
    ) /*: Schema*/ => {
        return ItemSchema;
    });

export const runServer = <Delta, Data>(
    port: number,
    dataPath: string,
    server: ServerState<Delta, Data>,
) => {
    const express = require('express');
    const ws = require('express-ws');

    const app = express();
    const wsInst = ws(app);
    app.use(require('cors')({ exposedHeaders: ['etag'] }));
    app.use(require('body-parser').json());

    const genEtag = stat => `${stat.mtime.getTime()}:${stat.size}`;

    app.get('/blob/:name', (req, res) => {
        const filePath = path.join(dataPath, 'blobs', req.params['name']);
        if (!fs.existsSync(filePath)) {
            res.status(404);
            return res.end();
        }
        const stat = fs.statSync(filePath);
        const etag = genEtag(stat);
        if (etag == req.get('if-none-match')) {
            res.set('ETag', etag);
            console.log('GET no change', etag);
            res.status(304);
            res.end();
            return;
        }
        console.log('GET', etag);
        res.set('ETag', etag);
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    });

    app.put('/blob/:name', (req, res) => {
        const filePath = path.join(dataPath, 'blobs', req.params['name']);
        fs.writeFileSync(filePath, JSON.stringify(req.body), 'utf8');
        const stat = fs.statSync(filePath);
        const etag = genEtag(stat);
        console.log('Updating server state', etag);
        res.set('ETag', etag);
        res.status(204);
        res.end();
    });

    app.post('/sync', (req, res) => {
        if (!req.query.sessionId) {
            throw new Error('No sessionId');
        }
        res.json(post(server, req.query.sessionId, req.body));
    });

    const clients = {};

    app.ws('/sync', function(ws, req) {
        if (!req.query.sessionId) {
            console.log('no sessionid');
            throw new Error('No sessionId');
        }
        onWebsocket(server, clients, req.query.sessionId, ws);
    });

    const http = app.listen(port);
    return { http, app, wsInst };
};

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
        // console.log(data);
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
