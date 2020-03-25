// @flow
import React from 'react';
import { render } from 'react-dom';

import {
    hlc,
    type HLC,
    createBlobClient,
    PersistentClock,
    localStorageClockPersist,
    inMemoryClockPersist,
    makeBlobPersistence,
    createBasicBlobNetwork,
    createDeltaClient,
    makeDeltaPersistence,
    createWebSocketNetwork,
} from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { ItemSchema, NoteSchema } from '../shared/schema.js';

import * as ncrdt from '../../../packages/nested-object-crdt/src/new';
import * as rich from '../../../packages/rich-text-crdt';
import * as textBinding from '../../../packages/rich-text-crdt/text-binding';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
window.applied = [];
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    console.log('!!! applying rich text delta', text, delta);
    window.applied.push({ text, delta });
    window.rich = rich;
    return {
        value: rich.apply(text, delta),
        meta,
    };
};

const newCrdt = {
    merge: (one, two) => {
        if (!one) return two;
        return ncrdt.mergeTwo(one, two, (v1, _, v2, __) => ({
            value: rich.merge(v1, v2),
            meta: null,
        }));
    },
    latestStamp: ncrdt.latestStamp,
    value: d => d.value,
    deltas: {
        ...ncrdt.deltas,
        stamp: data => ncrdt.deltas.stamp(data, () => null),
        apply: (base, delta) =>
            ncrdt.applyDelta(base, delta, applyOtherDelta, otherMerge),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return ncrdt.createWithSchema(
            value,
            stamp,
            getStamp,
            schema,
            value => null,
        );
    },
};

const setupBlob = () => {
    return createBlobClient(
        newCrdt,
        { tasks: ItemSchema, notes: NoteSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeBlobPersistence('local-first-blob', ['tasks', 'notes']),
        createBasicBlobNetwork('http://localhost:9900/blob/awesome.blob'),
    );
};

const setupDelta = () => {
    return createDeltaClient(
        newCrdt,
        { tasks: ItemSchema, notes: NoteSchema },
        new PersistentClock(inMemoryClockPersist('local-first')),
        makeDeltaInMemoryPersistence('local-first', ['tasks', 'notes']),
        // new PersistentClock(localStorageClockPersist('local-first')),
        // makeDeltaPersistence('local-first', ['tasks', 'notes']),

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
    const [noteCol, noteData] = useCollection(client, 'notes');
    const [connected, setConnected] = React.useState(false);
    React.useEffect(() => {
        client.onSyncStatus(status => setConnected(status));
    }, []);
    return (
        <div style={{ margin: '32px 64px' }}>
            <TextBindingExample />
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
                    noteCol.save(id, {
                        title: 'New note',
                        createDate: Date.now(),
                        body: rich.init(client.sessionId),
                    });
                }}
            >
                Add a note
            </button>
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
            {Object.keys(noteData)
                .sort(
                    (a, b) => noteData[a].createdDate - noteData[b].createdDate,
                )
                .map(id => (
                    <Note
                        key={id}
                        sessionId={client.sessionId}
                        id={id}
                        item={noteData[id]}
                        col={noteCol}
                    />
                ))}
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

const TextBindingExample = () => {
    const [text, setText] = React.useState(() => rich.init());
    const plain = rich.toString(text);
    return (
        <div>
            <textarea
                value={plain}
                onChange={e => {
                    const value = e.target.value;
                    const change = textBinding.inferChange(
                        plain,
                        value,
                        e.target.selectionStart === e.target.selectionEnd
                            ? e.target.selectionStart
                            : null,
                    );
                    console.log(plain, value, change);
                    const deltas = [];
                    // const clone = { ...text };
                    if (change.removed) {
                        deltas.push(
                            rich.del(
                                text,
                                change.removed.at,
                                change.removed.len,
                            ),
                        );
                    }
                    if (change.added) {
                        deltas.push(
                            rich.insert(
                                text,
                                'a',
                                change.added.at,
                                change.added.text,
                            ),
                        );
                    }
                    console.log(deltas);
                    // col.applyRichTextDelta(id, ['body'], deltas);
                    setText(rich.apply(text, deltas));
                }}
            />
            <div style={{ whiteSpace: 'pre' }}>
                {JSON.stringify(text, null, 2)}
            </div>
        </div>
    );
};

const Note = ({ id, item, col, sessionId }) => {
    console.log(item);
    let currentText = rich.toString(item.body);
    return (
        <div>
            Note
            <div>{item.title || 'Untitled'}</div>
            <div>
                <textarea
                    value={currentText}
                    onChange={e => {
                        const newValue = e.target.value;
                        const change = textBinding.inferChange(
                            currentText,
                            newValue,
                            e.target.selectionStart === e.target.selectionEnd
                                ? e.target.selectionStart
                                : null,
                        );
                        console.log('>> change inferred <<', change);
                        const deltas = [];
                        if (change.removed) {
                            deltas.push(
                                rich.del(
                                    item.body,
                                    change.removed.at,
                                    change.removed.len,
                                ),
                            );
                        }
                        if (change.added) {
                            deltas.push(
                                rich.insert(
                                    item.body,
                                    sessionId,
                                    change.added.at,
                                    change.added.text,
                                ),
                            );
                        }
                        console.log('applying', deltas);
                        col.applyRichTextDelta(id, ['body'], deltas);
                    }}
                />
            </div>
            <div style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>
                {JSON.stringify(item.body, null, 2)}
            </div>
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
