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
} from '../fault-tolerant/server';
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

const sqlite3 = require('better-sqlite3');
const fs = require('fs');

function queryAll(db, sql, params = []) {
    let stmt = db.prepare(sql);
    return stmt.all(...params);
}

function queryGet(db, sql, params = []) {
    let stmt = db.prepare(sql);
    return stmt.get(...params);
}

function queryRun(db, sql, params = []) {
    let stmt = db.prepare(sql);
    return stmt.run(...params);
}

const setupPersistence = (baseDir: string) => {
    const db = sqlite3(baseDir + '/data.db');
    const dbs = {};
    const tableName = col => col + ':messages';
    const escapedTableName = col => JSON.stringify(tableName(col));
    const setupDb = col => {
        if (dbs[col]) {
            return;
        }
        if (
            queryAll(db, 'select name from sqlite_master where name = ?', [
                col + ':messages',
            ]).length === 0
        ) {
            queryRun(
                db,
                `CREATE TABLE ${escapedTableName(
                    col,
                )} (id INTEGER PRIMARY KEY AUTOINCREMENT, node TEXT, delta TEXT, sessionId TEXT)`,
                [],
            );
        }
        dbs[col] = true;
        return;
    };
    return {
        addDeltas(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
        ) {
            setupDb(collection);
            const insert = db.prepare(
                `INSERT INTO ${escapedTableName(
                    collection,
                )} (node, delta, sessionId) VALUES (@node, @delta, @sessionId)`,
            );

            db.transaction(deltas => {
                deltas.forEach(({ node, delta, sessionId }) => {
                    insert.run({
                        node,
                        sessionId,
                        delta: JSON.stringify(delta),
                    });
                });
            })(deltas);
        },
        deltasSince(
            collection: string,
            lastSeen: ?CursorType,
            sessionId: string,
        ) {
            setupDb(collection);
            const transaction = db.transaction((lastSeen, sessionId) => {
                const rows = lastSeen
                    ? queryAll(
                          db,
                          `SELECT * from ${escapedTableName(collection)}`,
                      )
                    : queryAll(
                          db,
                          `SELECT * from ${escapedTableName(
                              collection,
                          )} where id > ?`,
                          [lastSeen],
                      );
                const deltas = rows.map(({ node, sessionId, delta }) => ({
                    node,
                    sessionId,
                    delta: JSON.parse(delta),
                }));
                const cursor = queryGet(
                    db,
                    `SELECT max(id) as maxId from ${escapedTableName(
                        collection,
                    )}`,
                    [],
                );
                return { deltas, cursor: cursor ? cursor.maxId : null };
            });
            return transaction(lastSeen, sessionId);
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

app.post('/sync', (req, res) => {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    let maxStamp = null;
    console.log(`sync:messages`, req.body);
    const acks = req.body
        .map(message => onMessage(server, req.query.sessionId, message))
        .filter(Boolean);
    console.log('ack', acks);
    const messages = getMessages(server, req.query.sessionId);
    console.log('messags', messages);

    res.json(acks.concat(messages));
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
    ws.on('message', data => {
        const messages = JSON.parse(data);
        messages.forEach(message =>
            onMessage(server, req.query.sessionId, message),
        );
        const response = getMessages(server, req.query.sessionId);

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
