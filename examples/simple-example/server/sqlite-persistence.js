// @flow

import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import type { CursorType } from '../fault-tolerant/server';
const sqlite3 = require('better-sqlite3');

function queryAll(db, sql, params = []) {
    let stmt = db.prepare(sql);
    // console.log('query all', sql, params);
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
                    // sessionId will be *null* is this is an amalgamated changeset and includes changes
                    // from multiple sessions.
                )} (id INTEGER PRIMARY KEY AUTOINCREMENT, changes TEXT NOT NULL, sessionId TEXT)`,
                [],
            );
        }
        dbs[col] = true;
        return;
    };
    return {
        addDeltas(
            collection: string,
            sessionId: string,
            deltas: Array<{ node: string, delta: Delta }>,
        ) {
            setupDb(collection);
            const insert = db.prepare(
                `INSERT INTO ${escapedTableName(
                    collection,
                )} (changes, sessionId) VALUES (@changes, @sessionId)`,
            );
            insert.run({
                sessionId,
                changes: JSON.stringify(deltas),
            });
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
                          `SELECT changes from ${escapedTableName(
                              collection,
                          )} where id > ? and sessionId != ?`,
                          [lastSeen, sessionId],
                      )
                    : queryAll(
                          db,
                          `SELECT changes from ${escapedTableName(
                              collection,
                          )} where sessionId != ?`,
                          [sessionId],
                      );
                // console.log('db', escapedTableName(collection));
                // console.log('getting deltas', rows, lastSeen, sessionId);
                const deltas = [].concat(
                    ...rows.map(({ changes }) => JSON.parse(changes)),
                );
                const cursor = queryGet(
                    db,
                    `SELECT max(id) as maxId from ${escapedTableName(
                        collection,
                    )}`,
                    [],
                );
                return { deltas, cursor: cursor ? cursor.maxId : null };
            });
            // console.log('transacting');
            return transaction(lastSeen, sessionId);
        },
    };
};

export default setupPersistence;
