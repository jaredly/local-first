// @flow
import React from 'react';
import { render } from 'react-dom';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
// import makeClient from './poll';
import makeClient from './ws';
import {
    getCollection,
    type ClientState,
    type CursorType,
} from '../fault-tolerant/client';
import { ItemSchema } from '../shared/schema.js';

const makePersistence = () => {
    const { openDB } = require('idb');
    const dbs = {};
    const getDb = async collection => {
        if (dbs[collection]) {
            return dbs[collection];
        }

        const db = (dbs[collection] = await openDB('collection', 1, {
            upgrade(db, oldVersion, newVersion, transation) {
                db.createObjectStore('deltas', {
                    keyPath: 'stamp',
                });
                db.createObjectStore('nodes', { keyPath: 'id' });
                db.createObjectStore('meta');
            },

            // TODO handle blocked, blocking, etc.
        }));
        return db;
    };

    return {
        async deltas(collection: string) {
            const db = await getDb(collection);
            const all = await db.getAll('deltas');
            return all;
        },
        async addDeltas(
            collection: string,
            deltas: Array<{ node: string, delta: Delta, stamp: string }>,
        ) {
            const db = await getDb(collection);
            const tx = db.transaction('deltas', 'readwrite');
            deltas.forEach(obj => tx.store.put(obj));
            await tx.done;
        },
        async getServerCursor(collection: string) {
            const db = await getDb(collection);
            return await db.get('meta', 'cursor');
        },
        async deleteDeltas(collection: string, upTo: string) {
            console.log('delete up to', upTo);
            const db = await getDb(collection);
            let cursor = await db
                .transaction('deltas', 'readwrite')
                .store.openCursor(IDBKeyRange.upperBound(upTo));

            while (cursor) {
                console.log('deleting', cursor.key, cursor.delete);
                console.log('del', cursor.delete());
                cursor = await cursor.continue();
            }
        },
        async get(collection: string, id: string) {
            const db = await getDb(collection);
            return await db.get('nodes', id);
        },
        async getAll(collection: string) {
            const db = await getDb(collection);
            const items = await db.getAll('nodes');
            const res = {};
            console.log('items', items);
            items.forEach(item => (res[item.id] = item.value));
            console.log('all', res);
            return res;
        },
        async changeMany<T>(
            collection: string,
            ids: Array<string>,
            process: ({ [key: string]: T }) => void,
            serverCursor: ?CursorType,
        ) {
            const db = await getDb(collection);
            const tx = db.transaction(['meta', 'nodes'], 'readwrite');
            const nodes = tx.objectStore('nodes');
            const gotten = await Promise.all(ids.map(id => nodes.get(id)));
            console.log('gotten', gotten);
            const map = {};
            gotten.forEach(res => (res ? (map[res.id] = res.value) : null));
            console.log('pre-process', JSON.stringify(map));
            process(map);
            console.log('processed', ids, map);
            ids.forEach(id =>
                map[id] ? nodes.put({ id, value: map[id] }) : null,
            );
            if (serverCursor) {
                tx.objectStore('meta').put(serverCursor, 'cursor');
            }
            return map;
        },
    };
};

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);
const {
    client,
    onConnection,
}: {
    onConnection: *,
    client: ClientState<Delta, Data>,
} = (window.client = makeClient(
    makePersistence(),
    // 'http://localhost:9900/sync',
    'ws://localhost:9104/sync',
    genId(),
    crdt,
));

type Tasks = {
    [key: string]: {
        completed: boolean,
        title: string,
        createdDate: number,
        tags: { [key: string]: boolean },
    },
};

const useCollection = (client, name) => {
    const col = React.useMemo(
        () => getCollection(client, name, ItemSchema),
        [],
    );
    const [data, setData] = React.useState(({}: Tasks));
    React.useEffect(() => {
        col.loadAll().then(data => {
            console.log('loaded all', data);
            setData(a => ({ ...a, ...data }));
            col.onChanges(changes => {
                console.log('changes', changes);
                setData(data => {
                    const n = { ...data };
                    changes.forEach(({ value, id }) => {
                        if (value) {
                            n[id] = value;
                        } else {
                            delete n[id];
                        }
                    });
                    return n;
                });
            });
        });
    }, []);
    return [col, data];
};

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const App = () => {
    const [col, data] = useCollection(client, 'tasks');
    const [connected, setConnected] = React.useState(false);
    React.useEffect(() => {
        onConnection(connected => setConnected(connected));
    }, []);
    return (
        <div style={{ margin: '32px 64px' }}>
            <div>Hello! We are {connected ? 'Online' : 'Offline'}</div>
            <button
                onClick={() => {
                    const id = genId();
                    col.save(id, {
                        title: 'Item ' + (Object.keys(data).length + 1),
                        completed: false,
                        createdDate: Date.now(),
                        tags: {},
                    });
                }}
            >
                Add a thing
            </button>
            {Object.keys(data)
                .sort((a, b) => data[a].createdDate - data[b].createdDate)
                .map(id => (
                    <Item
                        key={id}
                        item={data[id]}
                        onChange={(attr, value) => {
                            col.setAttribute(id, data[id], attr, value);
                        }}
                    />
                ))}
        </div>
    );
};

const Item = ({ item, onChange }) => {
    const [text, setText] = React.useState(null);
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                cursor: 'pointer',
            }}
        >
            <input
                type="checkbox"
                style={{ cursor: 'pointer' }}
                onChange={evt => {
                    onChange('completed', !item.completed);
                }}
                checked={item.completed}
            />
            {text == null ? (
                <div
                    style={{
                        flex: 1,
                        padding: '4px 8px',
                        cursor: 'text',
                    }}
                    onClick={evt => evt.stopPropagation()}
                    onMouseDown={evt => {
                        evt.preventDefault();
                        setText(item.title);
                    }}
                >
                    {item.title}
                </div>
            ) : (
                <input
                    type="text"
                    value={text}
                    style={{
                        fontFamily: 'inherit',
                        padding: '4px 8px',
                        fontSize: 'inherit',
                        margin: 0,
                        border: 'none',
                    }}
                    autoFocus
                    onClick={evt => {
                        evt.target.selectionStart = 0;
                        evt.target.selectionEnd = evt.target.value.length;
                    }}
                    onChange={evt => setText(evt.target.value)}
                    onBlur={() => {
                        setText(null);
                        onChange('title', text);
                    }}
                    onKeyDown={evt => {
                        if (evt.key === 'Enter') {
                            setText(null);
                            onChange('title', text);
                        }
                    }}
                />
            )}
        </div>
    );
};

const root = document.getElementById('root');
if (root) {
    render(<App />, root);
}
