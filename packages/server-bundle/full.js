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
        const middleware = [auth.middleware(authDb, secret)];

        setupBlob(
            state.app,
            req => path.join(currentPath, req.auth.id, 'blobs'),
            middleware,
            `dbs/${name}/blob`,
        );
        setupPolling(state.app, getServer, middleware, `dbs/${name}/sync`);
        setupWebsocket(state.app, getServer, middleware, `dbs/${name}/sync`);
    });

    auth.setupAuth(authDb, state.app, secret);
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

        auth.setupAuth(authDb, state.app, secret);
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
