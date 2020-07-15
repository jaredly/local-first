// @flow
import type { ClientMessage, ServerMessage, CursorType, ServerState } from '../core/src/server';

import type { Schema } from '../nested-object-crdt/src/schema';
export { validateDelta, validate, subSchema } from '../nested-object-crdt/src/schema';
export type { Schema };

import path from 'path';
import fs from 'fs';

import { getBlob, putBlob } from './blob';
import { post } from './poll';
import { onWebsocket } from './websocket';

import express from 'express';
import ws from 'express-ws';

type req = any;
type Middleware = Array<(req, *, () => void) => void>;

export const setupBlob = (
    app: express,
    getDataPath: req => string,
    middleware: Middleware = [],
    prefix: string = '/blob',
) => {
    app.get(prefix + '/:name', middleware, (req, res) => {
        const filePath = path.join(getDataPath(req), req.params['name']);
        getBlob(filePath, req.get('if-none-match'), res);
    });

    app.put(prefix + '/:name', middleware, (req, res) => {
        const filePath = path.join(getDataPath(req), req.params['name']);
        putBlob(filePath, req.body, res);
    });
};

export const setupPolling = function<Delta, Data>(
    app: express,
    getServer: req => ServerState<Data, Delta>,
    middleware: Middleware = [],
    path: string = '/sync',
) {
    app.post(path, middleware, (req, res) => {
        if (!req.query.sessionId) {
            throw new Error('No sessionId');
        }
        res.json(post(getServer(req), req.query.sessionId, req.body));
    });
};

export const setupWebsocket = function<Delta, Data>(
    app: express,
    getServer: express.Request => ServerState<Data, Delta>,
    middleware: Middleware = [],
    path: string = '/sync',
) {
    const clients = {};

    console.log('websocketing on', path);
    if (middleware.length) {
        app.use(path, middleware);
    }
    app.ws(path, function(ws, req) {
        if (!req.query.siteId) {
            ws.close();
            console.log('Closing -- siteId missing');
            throw new Error('No siteId');
        }
        try {
            const server = getServer(req);
            onWebsocket(server, clients, req.query.siteId, ws);
        } catch (err) {
            console.log('noooo');
            console.error(err);
        }
    });
};

export const setupExpress = () => {
    const app = express();
    const wsInst = ws(app);
    app.use(require('cors')({ exposedHeaders: ['etag', 'X-Session'] }));
    app.use(require('body-parser').json());

    return { app, wsInst };
};

export const runServer = <Delta, Data>(
    getBlobDataPath: req => string,
    getServer: req => ServerState<Delta, Data>,
    middleware: Middleware = [],
) => {
    const { app, wsInst } = setupExpress();

    setupBlob(app, getBlobDataPath, middleware);
    setupPolling(app, getServer, middleware);
    setupWebsocket(app, getServer, middleware);
    return { app, wsInst };
};
