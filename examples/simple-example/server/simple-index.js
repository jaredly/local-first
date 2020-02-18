#!/usr/bin/env node -r @babel/register
// @flow

import express from 'express';
import * as crdt from '../../../packages/nested-object-crdt';
import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import type { Schema } from '../../../packages/nested-object-crdt/src/schema.js';
import ws from 'express-ws';
import make, {
    onMessage,
    getMessages,
    hasCollection,
    loadCollection,
} from '../simple/server';
import type { ClientMessage, ServerMessage } from '../simple/server';
import { ItemSchema } from '../shared/schema.js';
const app = express();
ws(app);

app.use(require('cors')());
app.use(require('body-parser').json());

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

const setupPersistence = (baseDir: string) => {
    const dbs = {};
    const getDb = col =>
        dbs[col] ?? (dbs[col] = levelup(leveldown(baseDir + '/' + col)));
    return {
        load: async (collection: string) => {
            const db = getDb(collection);
            const deltas = (
                await loadAll(
                    db.createReadStream({
                        gt: 'message:',
                        lt: 'message:~',
                    }),
                    true,
                )
            ).map(message => JSON.parse(message.value));
            const nodes = toObj(
                await loadAll(
                    db.createReadStream({
                        gt: 'node:',
                        lt: 'node:~',
                    }),
                    true,
                ),
                k => k.key.slice('node:'.length),
                k => JSON.parse(k.value),
            );
            return { data: nodes, deltas };
        },
        update: (
            collection: string,
            startingIndex: number,
            deltas: any,
            items: any,
        ) => {
            const db = getDb(collection);
            db.batch(
                deltas
                    .map((delta, i) => ({
                        type: 'put',
                        key: `message:${(startingIndex + i)
                            .toString(36)
                            // 11 base 36 is enough to contain MAX_SAFE_INTEGER
                            .padStart(11, '0')}`,
                        value: JSON.stringify(delta),
                    }))
                    .concat(
                        items.map(({ key, data }) => ({
                            type: 'put',
                            key: `node:${key}`,
                            value: JSON.stringify(data),
                        })),
                    ),
            );
            return Promise.resolve();
        },
    };
};

const server = make<Delta, Data>(
    crdt,
    setupPersistence(__dirname + '/.data'),
    (collectionId: string): Schema => {
        return ItemSchema;
    },
);

const loadCollections = messages => {
    const collectionsToLoad = {};
    messages.forEach(message => {
        if (!hasCollection(server, message.collection)) {
            collectionsToLoad[message.collection] = true;
        }
    });
    const promises = Object.keys(collectionsToLoad).map(id =>
        loadCollection(server, id),
    );

    return promises;
};

app.post('/sync', async (req, res) => {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    const promises = loadCollections(req.body);
    if (promises.length) {
        await Promise.all(promises);
    }
    req.body.forEach(message =>
        onMessage(server, req.query.sessionId, message),
    );
    const response = getMessages(server, req.query.sessionId);

    // console.log(response);
    // console.log(server.collections.tasks);
    res.json(response);
});

const clients = {};

app.ws('/sync', function(ws, req) {
    if (!req.query.sessionId) {
        console.log('no sessionid');
        throw new Error('No sessionId');
    }
    clients[req.query.sessionId] = {
        send: messages => ws.send(JSON.stringify(messages)),
    };
    // server.clients[req.query.sessionId] = {
    //     collections: {},
    //     send: messages => ws.send(JSON.stringify(messages)),
    // };
    ws.on('message', async data => {
        const messages = JSON.parse(data);
        const promises = loadCollections(messages);
        if (promises.length) {
            await Promise.all(promises);
        }
        messages.forEach(message =>
            onMessage(server, req.query.sessionId, message),
        );
        const response = getMessages(server, req.query.sessionId);

        // console.log('ok', data);
        ws.send(JSON.stringify(response));

        Object.keys(clients).forEach(id => {
            if (id !== req.query.sessionId) {
                const response = getMessages(server, id);
                clients[id].send(messages);
            }
        });
    });
    ws.on('close', () => {
        delete clients[req.query.sessionId];
    });
});

app.listen(9900);
console.log('listening on 9900');
