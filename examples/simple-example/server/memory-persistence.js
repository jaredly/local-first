// @flow

import type { Delta, CRDT as Data } from '../../../packages/nested-object-crdt';
import type { CursorType } from '../../../packages/core/src/server';

class FakeDb {
    collections: {
        [colid: string]: Array<any>,
    };
    constructor() {
        this.collections = {};
    }
    createTable(colid: string) {
        this.collections[colid] = [];
    }
    transaction(fn) {
        return function() {
            return fn.apply(null, arguments);
        };
    }
    getAllSince(colid, sessionId, minId) {
        const res = this.collections[colid].filter((item, i) => {
            if (minId != null && minId >= i) {
                return;
            }
            if (item.sessionId === sessionId) {
                return;
            }
            return true;
        });
        return res;
    }
    maxId(colid) {
        return this.collections[colid].length - 1;
    }
    insert(colid, data) {
        this.collections[colid].push(data);
    }
}

const setupPersistence = (baseDir: string) => {
    const db = new FakeDb();
    const dbs = {};
    const tableName = col => col + ':messages';
    const escapedTableName = col => JSON.stringify(tableName(col));
    const setupDb = col => {
        if (dbs[col]) {
            return;
        }
        db.createTable(col);
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
            db.insert(collection, {
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
                const rows = db.getAllSince(collection, sessionId, lastSeen);
                const deltas = [].concat(
                    ...rows.map(({ changes }) => JSON.parse(changes)),
                );
                const cursor = db.maxId(collection);
                if (!cursor) {
                    return null;
                }
                return { deltas, cursor: cursor };
            });
            return transaction(lastSeen, sessionId);
        },
    };
};

export default setupPersistence;
