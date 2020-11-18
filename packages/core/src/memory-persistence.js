// @flow

// import type { Delta, CRDT as Data } from '../../nested-object-crdt/src';
import type { CursorType, Persistence } from './server';

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
        return function(...args) {
            return fn(...args);
        };
    }
    getAllSince(colid, sessionId, minId: ?CursorType) {
        // console.log(
        //     `[db] Getting all ${colid} for ${sessionId} since ${
        //         minId != null ? minId : 'no-min'
        //     }`,
        // );
        // console.log(`Total: ${this.collections[colid].length}`);
        const res = this.collections[colid].filter((item, i) => {
            if (minId != null && minId >= i) {
                return;
            }
            if (item.sessionId === sessionId) {
                return;
            }
            return true;
        });
        // console.log(`Matched: ${res.length}`);
        return res;
    }
    maxId(colid): CursorType {
        return !this.collections[colid].length ? -1 : this.collections[colid].length - 1;
    }
    insert(colid, data) {
        this.collections[colid].push(data);
    }
}

const setupPersistence = function<Delta, Data>(): Persistence<Delta, Data> {
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
        compact() {
            throw new Error('NOpe');
        },
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
        ): ?{
            deltas: Array<{ node: string, delta: Delta }>,
            cursor: CursorType,
        } {
            setupDb(collection);
            const transaction = db.transaction((lastSeen, sessionId) => {
                const rows = db.getAllSince(collection, sessionId, lastSeen);
                const deltas: Array<any> = [].concat(
                    ...rows.map(({ changes }) => JSON.parse(changes)),
                );
                const cursor = db.maxId(collection);
                if (cursor == -1) {
                    if (rows.length) {
                        throw new Error(`No maxId, but deltas returned! ${rows.length}`);
                    }
                    return null;
                }
                return { deltas, cursor: cursor };
            });
            // $FlowFixMe
            return transaction(lastSeen, sessionId);
        },
    };
};

export default setupPersistence;
