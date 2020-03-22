// @flow
import React from 'react';
import { render } from 'react-dom';

import {
    hlc,
    type HLC,
    createBlobClient,
    PersistentClock,
    localStorageClockPersist,
    makeBlobPersistence,
    createBasicBlobNetwork,
    createDeltaClient,
    makeDeltaPersistence,
    createWebSocketNetwork,
    // crdt,
} from '../../../packages/client-bundle';
import { ItemSchema } from '../shared/schema.js';

import * as ncrdt from '../../../packages/nested-object-crdt/src/new';
import * as text from '../../../packages/rich-text-crdt';

// const otherMerge =

const newCrdt = {
    merge: (one, two) => {
        if (!one) return two;
        return ncrdt.mergeTwo(one, two);
    },
    latestStamp: ncrdt.latestStamp,
    value: d => d.value,
    deltas: {
        ...ncrdt.deltas,
        apply: (base, delta) =>
            ncrdt.applyDelta(
                base,
                delta,
                () => {
                    throw new Error('no other yet');
                },
                () => {
                    throw new Error('no other yet');
                },
            ),
    },
    createValue: ncrdt.createDeep,
};

const setupBlob = () => {
    return createBlobClient(
        // crdt,
        newCrdt,
        { tasks: ItemSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeBlobPersistence('local-first-blob', ['tasks']),
        createBasicBlobNetwork('http://localhost:9900/blob/awesome.blob'),
    );
};

const setupDelta = () => {
    return createDeltaClient(
        // crdt,
        newCrdt,
        { tasks: ItemSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeDeltaPersistence('local-first', ['tasks']),
        // createPollingNetwork('http://localhost:9900/sync'),
        createWebSocketNetwork('ws://localhost:9900/sync'),
    );
};

// const client = setupBlob();
const client = setupDelta();

type Tasks = {
    [key: string]: {
        completed: boolean,
        title: string,
        createdDate: number,
        tags: { [key: string]: boolean },
    },
};

const useCollection = (client, name) => {
    const col = React.useMemo(() => client.getCollection(name), []);
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
        client.onSyncStatus(status => setConnected(status));
    }, []);
    return (
        <div style={{ margin: '32px 64px' }}>
            <div>
                Hello! We are{' '}
                {connected && connected.status !== 'disconnected'
                    ? 'Online'
                    : 'Offline'}{' '}
                {client.sessionId}
            </div>
            <button
                onClick={() => {
                    const id = client.getStamp();
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
                            col.setAttribute(id, [attr], value);
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
