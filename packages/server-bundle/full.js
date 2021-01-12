// @flow
import * as crdt from '../nested-object-crdt/src/new';
import * as rich from '../rich-text-crdt';
import { type Schema, validateDelta } from '../nested-object-crdt/src/schema.js';
import type { Delta as NewDelta, CRDT } from '../nested-object-crdt/src/types.js';
import make from '../core/src/server';
import path from 'path';
import fs from 'fs';

import setupPersistence from '../server-bundle/sqlite-persistence';
import setupInMemoryPersistence from '../core/src/memory-persistence';
import * as auth from '../auth';

import { runServer, setupWebsocket, setupPolling, setupExpress, setupBlob } from './';

import { getBlob, putBlob } from './blob';
import { post } from './poll';
import { onWebsocket } from './websocket';

type Delta = NewDelta<any, null, any>;
type Data = CRDT<any, null>;

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

export const crdtImpl = {
    createWithSchema: (data: any, stamp: string, getStamp: () => string, schema: Schema) =>
        crdt.createWithSchema<any, any>(data, stamp, getStamp, schema, () => null),
    createEmpty: crdt.createEmpty,
    applyDelta: (base, delta) => crdt.applyDelta(base, delta, (applyOtherDelta: any), otherMerge),
    deltas: {
        stamp: delta => crdt.deltas.stamp(delta, () => null),
    },
    value: (d: { value: * }) => d.value,
};

export const serverForUser = (
    dataPath: string,
    userId: string,
    getSchemaChecker: string => ?(Delta) => ?string,
) => {
    return make<Delta, Data>(
        crdtImpl,
        setupPersistence(path.join(dataPath, '' + userId)),
        getSchemaChecker,
    );
};

const makeSchemaCheckers = schemas => colid =>
    schemas[colid] ? delta => validateDelta(schemas[colid], delta) : null;

export const getAuthDb = (dataPath: string) => {
    const sqlite3 = require('better-sqlite3');
    const authDb = sqlite3(path.join(dataPath, 'users.db'));
    auth.createTables(authDb);
    return authDb;
};

/**
 * Directory layout of this server:
 * - [dataPath]/
 *      [databaseType]/ -- this is how we look up the schema for the given db
 *          [other-path-substrings]/
 *              @[userid]/ -- I wonder if we want to instead do `databaseType/@userId/sub-paths/data.db`?
 *                         -- like, the sub-paths are all going to be the same kind of thing
 *                         -- for the tree-notes case, that definitely makes sense.
 *                         -- are there other cases that are different?
 *                  data.db
 */
export const runMulti2 = (
    dataPath: string,
    configs: {
        [name: string]: { [collection: string]: Schema },
    },
    port: number = 9090,
    requireInvite: boolean = false,
) => {
    const { SECRET: secret } = process.env;
    if (secret == null) {
        throw new Error('process.env.SECRET is required');
    }
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath);
    }

    const authDb = getAuthDb(dataPath);

    const { app } = setupExpress();
    const userServers = {};

    const getServer = req => {
        if (!req.auth) {
            throw new Error(`No auth`);
        }
        const key = req.auth.id + ':' + req.dbName;
        if (!userServers[key]) {
            userServers[key] = make<Delta, Data>(
                crdtImpl,
                setupPersistence(req.dataPath),
                makeSchemaCheckers(req.dbConfig),
            );
        }
        return userServers[key];
    };

    const dbMiddleware = (req, res, next) => {
        const dbName = req.query.db;
        const parts = dbName.split('/');
        if (parts.length > 10) {
            res.status(400);
            res.send(`Database path too long`);
            res.end();
        }
        if (!parts.every(part => part.match(/^[a-zA-Z0-9_-]+$/))) {
            res.status(400);
            res.send(`Invalid database name ${dbName}`);
            res.end();
            return;
        }
        const config = configs[parts[0]];
        if (!config) {
            res.status(404);
            res.send(`Database config ${parts[0]} not found`);
            res.end();
        } else {
            const subPath = parts.slice(1);
            const dbPath =
                subPath[0] === 'public'
                    ? path.join(dataPath, parts[0], subPath.join('/'))
                    : path.join(dataPath, parts[0], '@' + req.auth.id, subPath.join('/'));
            req.dbName = dbName;
            req.dbConfig = config;
            req.dataPath = dbPath;
            req.server = getServer(req);
            next();
        }
    };

    app.use('/dbs/', [auth.middleware(authDb, secret)]);

    // blobs!
    app.get('/dbs/blob', (req, res) => {
        // TODO validate blob data against some kind of schema?
        const filePath = path.join(req.dataPath, '@blobs', req.query.name);
        getBlob(filePath, req.get('if-none-match'), res);
    });

    app.put('/dbs/blob', (req, res) => {
        const filePath = path.join(req.dataPath, '@blobs', req.query.name);
        putBlob(filePath, req.body, res);
    });

    app.use('/dbs/sync', dbMiddleware);

    // polling!
    app.post('/dbs/sync', (req, res) => {
        if (!req.query.sessionId) {
            throw new Error('No sessionId');
        }
        res.json(post(req.server, req.query.sessionId, req.body));
    });

    // NOTE: This is a kindof wasteuful, although at the data sizes we're thinking of,
    // it's probably actually not a big deal?
    // But glitch's startup time is maybe a big deal, so it would be cool to cache it
    // with cloudflare anyway.
    app.get('/latest/', (req, res) => {
        const { db, collection, id } = req.query;
        if (!db || !collection || !id) {
            return res.status(400).json({ error: 'required: db, id, collection' });
        }
        const parts = db.split('/');
        const config = configs[parts[0]];
        if (!config) {
            return res.status(404).json({ error: 'no collection' });
        }
        const subPath = parts.slice(1);
        let userId = null;
        if (subPath[0] !== 'public') {
            const authData = auth.getAuth(authDb, secret, req);
            if (typeof authData === 'string') {
                return res.status(401).send(authData);
            }
            userId = authData.user.id;
        }
        const dbPath =
            userId == null
                ? path.join(dataPath, parts[0], subPath.join('/'))
                : path.join(dataPath, parts[0], '@' + userId, subPath.join('/'));
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ error: 'No such database' });
        }

        const persistence = setupPersistence(dbPath);
        const schemaCheckers = makeSchemaCheckers(config);

        const result = persistence.deltasSince(collection, null, 'server');
        if (!result) {
            return res.status(404).json({ error: 'no data' });
        }
        const relevantDeltas = result.deltas
            .filter(delta => delta.node === id)
            .map(change => change.delta);

        if (!relevantDeltas.length) {
            return res.status(404).json({ error: 'node not found' });
        }

        const data = relevantDeltas.reduce(
            (current, next) => crdtImpl.applyDelta(current, next),
            null,
        );

        if (data == null) {
            return res.status(500).json({ error: 'Delta reduce produced null' });
        }
        res.json(crdtImpl.value(data));
    });

    const clients = {};

    // websocket!
    app.ws('/dbs/sync', function(ws, req) {
        if (!req.query.siteId) {
            ws.close();
            throw new Error('No siteId');
        }
        try {
            onWebsocket(req.server, clients, req.query.siteId, ws);
        } catch (err) {
            console.log('noooo');
            console.error(err);
        }
    });

    auth.setupAuth(authDb, app, secret, requireInvite);
    app.listen(port);

    return { app };
};

// is auth shared? yes it's shared.
// but directories aren't shared I don't think.
export const runMulti = (
    dataPath: string,
    configs: {
        [name: string]: { [collection: string]: Schema },
    },
    port: number = 9090,
) => {
    const { SECRET: secret } = process.env;
    if (secret == null) {
        throw new Error('process.env.SECRET is required');
    }
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath);
    }

    const sqlite3 = require('better-sqlite3');
    const authDb = sqlite3(path.join(dataPath, 'users.db'));
    auth.createTables(authDb);
    const middleware = [auth.middleware(authDb, secret)];

    const state = setupExpress();

    Object.keys(configs).forEach(name => {
        const userServers = {};
        const currentPath = dataPath + '/' + name;
        const schemas = configs[name];

        const getSchemaChecker = colid =>
            schemas[colid] ? delta => validateDelta(schemas[colid], delta) : null;

        const getServer = req => {
            if (!req.auth) {
                throw new Error(`No auth`);
            }
            if (!userServers[req.auth.id]) {
                userServers[req.auth.id] = serverForUser(
                    currentPath,
                    req.auth.id,
                    getSchemaChecker,
                );
            }
            return userServers[req.auth.id];
        };

        setupBlob(
            state.app,
            req => path.join(currentPath, req.auth.id, 'blobs'),
            middleware,
            `/dbs/${name}/blob`,
        );
        setupPolling(state.app, getServer, middleware, `/dbs/${name}/sync`);
        setupWebsocket(state.app, getServer, middleware, `/dbs/${name}/sync`);
    });

    auth.setupAuth(authDb, state.app, secret, false);
    state.app.listen(port);
    return state;
};

export const run = (
    dataPath: string,
    getSchemaChecker: string => ?(Delta) => ?string,
    port: number = 9090,
) => {
    if (process.env.NO_AUTH == null) {
        const { SECRET: secret } = process.env;
        if (secret == null) {
            throw new Error("process.env.SECRET is required if you don't pass process.env.NO_AUTH");
        }

        const userServers = {};

        const sqlite3 = require('better-sqlite3');
        const authDb = sqlite3(path.join(dataPath, 'users.db'));
        auth.createTables(authDb);

        const state = runServer(
            req => path.join(dataPath, req.auth.id, 'blobs'),
            req => {
                if (!req.auth) {
                    throw new Error(`No auth`);
                }
                if (!userServers[req.auth.id]) {
                    userServers[req.auth.id] = serverForUser(
                        dataPath,
                        req.auth.id,
                        getSchemaChecker,
                    );
                }
                return userServers[req.auth.id];
            },
            [auth.middleware(authDb, secret)],
        );

        auth.setupAuth(authDb, state.app, secret, false);
        state.app.listen(port);
        return state;
    } else {
        const server = make<Delta, Data>(crdtImpl, setupPersistence(dataPath), getSchemaChecker);
        const ephemeralServer = make<Delta, Data>(
            crdtImpl,
            setupInMemoryPersistence(),
            getSchemaChecker,
        );
        dataPath = path.join(dataPath, 'anon');
        const state = runServer(
            // port,
            () => path.join(dataPath, 'blobs'),
            () => server,
        );
        console.log('setup ephemeral socket');
        setupWebsocket(state.app, () => ephemeralServer, [], '/ephemeral/sync');
        setupPolling(state.app, () => ephemeralServer, [], '/ephemeral/sync');
        state.app.listen(port);
        return state;
    }
};
