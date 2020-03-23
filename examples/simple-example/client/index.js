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
import { ItemSchema, NoteSchema } from '../shared/schema.js';

import * as ncrdt from '../../../packages/nested-object-crdt/src/new';
import * as rich from '../../../packages/rich-text-crdt';
import * as textBinding from '../../../packages/rich-text-crdt/text-binding';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2, v1.site), meta: null };
};
const applyOtherDelta = (text, meta, delta) => ({
    value: rich.apply(text, delta),
    meta,
});

const newCrdt = {
    merge: (one, two) => {
        if (!one) return two;
        return ncrdt.mergeTwo(one, two);
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
        // crdt,
        newCrdt,
        { tasks: ItemSchema, notes: NoteSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeBlobPersistence('local-first-blob', ['tasks', 'notes']),
        createBasicBlobNetwork('http://localhost:9900/blob/awesome.blob'),
    );
};

const setupDelta = () => {
    return createDeltaClient(
        // crdt,
        newCrdt,
        { tasks: ItemSchema, notes: NoteSchema },
        new PersistentClock(localStorageClockPersist('local-first')),
        makeDeltaPersistence('local-first', ['tasks', 'notes']),
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
                        id={id}
                        item={noteData[id]}
                        col={noteCol}
                        // onChange={(attr, value) => {
                        //     col.setAttribute(id, [attr], value);
                        // }}
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

const Note = ({ id, item, col }) => {
    console.log(item);
    let currentText = rich.toString(item.body);
    // let oldText = React.useRef(null)
    // oldText.value = rich.toString(item.body)
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
                                    change.added.at,
                                    change.added.text,
                                ),
                            );
                        }
                        col.applyRichTextDelta(id, ['body'], deltas);
                        // console.log(e.target.value);
                        // console.log(deltas);
                    }}
                />
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
