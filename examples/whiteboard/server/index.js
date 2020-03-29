// @flow
import * as crdt from '../../../packages/nested-object-crdt/src/new';
import type { Schema } from '../../../packages/nested-object-crdt/src/schema.js';
import type {
    Delta as NewDelta,
    CRDT,
} from '../../../packages/nested-object-crdt/src/types.js';
import make from '../../../packages/core/src/server';
import path from 'path';

import setupPersistence from '../../../packages/server-bundle/sqlite-persistence';
import setupInMemoryPersistence from '../../../packages/core/src/memory-persistence';
import * as auth from '../../../packages/auth';

import {
    runServer,
    setupWebsocket,
    setupPolling,
} from '../../../packages/server-bundle';

type Delta = NewDelta<any, null, any>;
type Data = CRDT<any, null>;

const crdtImpl = {
    createEmpty: crdt.createEmpty,
    applyDelta: crdt.applyDelta,
    deltas: {
        stamp: delta => crdt.deltas.stamp(delta, () => null),
    },
};

export const run = (dataPath: string, port: number = 9090) => {
    if (!process.env.NO_AUTH) {
        const { SECRET: secret } = process.env;
        if (!secret) {
            throw new Error(
                "process.env.SECRET is required if you don't pass process.env.NO_AUTH",
            );
        }

        const userServers = {};

        const state = runServer(
            port,
            req => path.join(dataPath, req.auth.id, 'blobs'),
            req => {
                if (!userServers[req.auth.id]) {
                    userServers[req.auth.id] = make<Delta, Data>(
                        crdtImpl,
                        setupPersistence(path.join(dataPath, req.auth.id)),
                    );
                }
                return userServers[req.auth.id];
            },
            [auth.middleware(db, secret)],
        );

        auth.setupAuth(db, state.app, secret);
        state.app.listen(port);
        return state;
    } else {
        const server = make<Delta, Data>(crdtImpl, setupPersistence(dataPath));
        const ephemeralServer = make<Delta, Data>(
            crdtImpl,
            setupInMemoryPersistence(),
        );
        dataPath = path.join(dataPath, 'anon');
        const state = runServer(
            // port,
            () => path.join(dataPath, 'blobs'),
            () => server,
        );
        console.log('setup ephemeral socket');
        setupWebsocket(state.app, () => ephemeralServer, '/ephemeral/sync');
        setupPolling(state.app, () => ephemeralServer, [], '/ephemeral/sync');
        state.app.listen(port);
        return state;
    }
};
