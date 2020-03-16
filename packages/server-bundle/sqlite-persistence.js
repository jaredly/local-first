// @flow

import type { Delta, CRDT as Data } from '../nested-object-crdt';
import type { CursorType } from '../core/src/server';
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
                )} (id INTEGER PRIMARY KEY AUTOINCREMENT, changes TEXT NOT NULL, date INTEGER NOT NULL, sessionId TEXT)`,
                [],
            );
        }
        dbs[col] = true;
        return;
    };
    return {
        compact(
            collection: string,
            date: number,
            merge: (Delta, Delta) => Delta,
        ) {
            setupDb(collection);
            const tx = db.transaction((collection, date) => {
                const rows = queryAll(
                    db,
                    `SELECT id, sessionId, changes from ${escapedTableName(
                        collection,
                    )} where date < ?`,
                    [date],
                );
                if (rows.length <= 1) {
                    return;
                }
                const byNode = {};
                let session = rows[0].sessionId;
                let maxId = rows[0].id;
                rows.forEach(({ id, sessionId, changes }) => {
                    if (id > maxId) {
                        maxId = id;
                    }
                    if (sessionId != session) {
                        session = null;
                    }
                    const deltas = JSON.parse(changes);
                    deltas.forEach(({ node, delta }) => {
                        if (!byNode[node]) {
                            byNode[node] = delta;
                        } else {
                            byNode[node] = merge(byNode[node], delta);
                        }
                    });
                });
                // delete the rows we got
                queryRun(
                    db,
                    `DELETE FROM ${escapedTableName(
                        collection,
                    )} where date < ?`,
                    [date],
                );
                queryRun(
                    db,
                    `INSERT INTO ${escapedTableName(
                        collection,
                    )} (id, changes, date, sessionId) VALUES (@id, @changes, @date, @sessionId)`,
                    [
                        {
                            id: maxId,
                            changes: JSON.stringify(
                                Object.keys(byNode).map(node => ({
                                    node,
                                    delta: byNode[node],
                                })),
                            ),
                            date,
                            sessionId: session,
                        },
                    ],
                );
            });
            tx(collection, date);
            // Vacuum just for fun, for benchmarks and stuff ya know.
            // queryRun(db, 'VACUUM into "smaller.db"');
        },
        addDeltas(
            collection: string,
            sessionId: string,
            deltas: Array<{ node: string, delta: Delta }>,
        ) {
            setupDb(collection);
            const insert = db.prepare(
                `INSERT INTO ${escapedTableName(
                    collection,
                )} (changes, date, sessionId) VALUES (@changes, @date, @sessionId)`,
            );
            insert.run({
                sessionId,
                date: Date.now(),
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
                if (!cursor) {
                    return null;
                }
                return { deltas, cursor: cursor.maxId };
            });
            // console.log('transacting');
            return transaction(lastSeen, sessionId);
        },
    };
};

export default setupPersistence;
