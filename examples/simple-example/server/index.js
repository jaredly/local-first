// @flow
import * as crdt from '../../../packages/nested-object-crdt/src/new';
import type { Schema } from '../../../packages/nested-object-crdt/src/schema.js';
import type {
    Delta as NewDelta,
    CRDT,
} from '../../../packages/nested-object-crdt/src/types.js';
import make, {
    onMessage,
    getMessages,
} from '../../../packages/core/src/server';
import type {
    ClientMessage,
    ServerMessage,
    CursorType,
    ServerState,
} from '../../../packages/core/src/server';
import { ItemSchema } from '../shared/schema.js';

import path from 'path';
import fs from 'fs';
import levelup from 'levelup';
import leveldown from 'leveldown';
// import setupPersistence from './sqlite-persistence';
import setupPersistence from './memory-persistence';

type Delta = NewDelta<any, null, RichDelta>;
type Data = CRDT<any, null>;

const crdtImpl = {
    createEmpty: crdt.createEmpty,
    applyDelta: crdt.applyDelta,
    deltas: {
        stamp: delta => crdt.deltas.stamp(delta, () => null),
    },
};

export const makeServer = (dataPath: string) =>
    make<Delta, Data>(crdtImpl, setupPersistence(dataPath), (
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
        console.log(`Getting blob ${req.params['name']}`);
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
        console.log(`Updating blob ${req.params['name']}`);
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
        send: (messages: Array<ServerMessage<Delta, Data>>) =>
            ws.send(JSON.stringify(messages)),
    };
    ws.on('message', data => {
        // console.log(data);
        const messages: Array<ClientMessage<Delta, Data>> = JSON.parse(data);
        const acks = messages
            .map(message => onMessage(server, sessionId, message))
            .filter(Boolean);
        const response = getMessages(server, sessionId);

        ws.send(JSON.stringify(acks.concat(response)));

        Object.keys(clients).forEach((id: string) => {
            if (id !== sessionId) {
                const response = getMessages(server, id);
                if (response.length) {
                    clients[id].send(response);
                }
            }
        });
    });
    ws.on('close', () => {
        delete clients[sessionId];
    });
};
