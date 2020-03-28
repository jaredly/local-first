// @flow
import type {
    ClientMessage,
    ServerMessage,
    CursorType,
    ServerState,
} from '../core/src/server';

import path from 'path';
import fs from 'fs';

import { getBlob, putBlob } from './blob';
import { post } from './poll';
import { onWebsocket } from './websocket';

import express from 'express';
import ws from 'express-ws';

export const setupBlob = (
    app: express,
    dataPath: string,
    prefix: string = '/blob',
) => {
    app.get(prefix + '/:name', (req, res) => {
        const filePath = path.join(dataPath, req.params['name']);
        getBlob(filePath, req.get('if-none-match'), res);
    });

    app.put(prefix + '/:name', (req, res) => {
        const filePath = path.join(dataPath, req.params['name']);
        putBlob(filePath, req.body, res);
    });
};

export const setupPolling = function<Delta, Data>(
    app: express,
    server: ServerState<Data, Delta>,
    path: string = '/sync',
) {
    app.post(path, (req, res) => {
        if (!req.query.sessionId) {
            throw new Error('No sessionId');
        }
        res.json(post(server, req.query.sessionId, req.body));
    });
};

export const setupWebsocket = function<Delta, Data>(
    app: express,
    server: ServerState<Data, Delta>,
    path: string = '/sync',
) {
    const clients = {};

    app.ws(path, function(ws, req) {
        if (!req.query.sessionId) {
            console.log('no sessionid');
            throw new Error('No sessionId');
        }
        onWebsocket(server, clients, req.query.sessionId, ws);
    });
};

export const runServer = <Delta, Data>(
    port: number,
    dataPath: string,
    server: ServerState<Delta, Data>,
) => {
    const app = express();
    const wsInst = ws(app);
    app.use(require('cors')({ exposedHeaders: ['etag'] }));
    app.use(require('body-parser').json());

    setupBlob(app, path.join(dataPath, 'blobs'));
    setupPolling(app, server);
    setupWebsocket(app, server);

    const http = app.listen(port);
    return { http, app, wsInst };
};
