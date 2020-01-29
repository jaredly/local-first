// @flow

import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import type { CursorType } from '../fault-tolerant/server';
const sqlite3 = require('better-sqlite3');

function queryAll(db, sql, params = []) {
    let stmt = db.prepare(sql);
    console.log('query all', sql, params);
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
                          `SELECT * from ${escapedTableName(
                              collection,
                          )} where id > ?`,
                          [lastSeen],
                      )
                    : queryAll(
                          db,
                          `SELECT * from ${escapedTableName(collection)}`,
                      );
                console.log('db', escapedTableName(collection));
                console.log('getting deltas', rows, lastSeen, sessionId);
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
            console.log('transacting');
            return transaction(lastSeen, sessionId);
        },
    };
};

export default setupPersistence;
