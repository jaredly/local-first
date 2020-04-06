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
import { checkConsistency } from '../../../packages/rich-text-crdt/check';
import * as textBinding from '../../../packages/rich-text-crdt/text-binding';

const otherMerge = (v1, m1, v2, m2) => {
    return { value: rich.merge(v1, v2), meta: null };
};
window.applied = [];
const applyOtherDelta = (text: rich.CRDT, meta: null, delta: rich.Delta) => {
    // console.log('!!! applying rich text delta', text, delta);
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
    value: (d) => d.value,
    deltas: {
        ...ncrdt.deltas,
        stamp: (data) => ncrdt.deltas.stamp(data, () => null),
        apply: (base, delta) => ncrdt.applyDelta(base, delta, applyOtherDelta, otherMerge),
    },
    createValue: (value, stamp, getStamp, schema) => {
        return ncrdt.createWithSchema(value, stamp, getStamp, schema, (value) => null);
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
        // new PersistentClock(inMemoryClockPersist()),
        // makeDeltaInMemoryPersistence(['tasks', 'notes']),
        new PersistentClock(localStorageClockPersist('local-first')),
        makeDeltaPersistence('local-first', ['tasks', 'notes']),

        // createPollingNetwork('http://localhost:9900/sync'),
        createWebSocketNetwork('ws://localhost:9900/sync'),
    );
};

// const client = setupBlob();
const client = setupDelta();

type Task = {
    completed: boolean,
    title: string,
    createdDate: number,
    tags: { [key: string]: boolean },
};

type Tasks = {
    [key: string]: Task,
};

type NoteT = {
    createdDate: number,
    title: string,
    body: rich.CRDT,
};

const useCollection = function<T: {}>(client, name) {
    const col = React.useMemo(() => client.getCollection(name), []);
    const [data, setData] = React.useState(({}: { [key: string]: T }));
    React.useEffect(() => {
        col.loadAll().then((data) => {
            // console.log('loaded all', data);
            setData((a) => ({ ...a, ...data }));
            col.onChanges((changes) => {
                // console.log('changes', changes);
                setData((data) => {
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
    const [col, data] = useCollection<Task>(client, 'tasks');
    const [noteCol, noteData] = useCollection<NoteT>(client, 'notes');
    const [connected, setConnected] = React.useState(false);
    React.useEffect(() => {
        client.onSyncStatus((status) => setConnected(status));
    }, []);
    return (
        <div style={{ margin: '32px 64px' }}>
            <div>
                Hello! We are{' '}
                {connected && connected.status !== 'disconnected' ? 'Online' : 'Offline'}{' '}
                {client.sessionId}
            </div>
            <button
                onClick={() => {
                    const id = client.getStamp();
                    noteCol.save(id, {
                        title: 'New note',
                        createdDate: Date.now(),
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
                .sort((a, b) => noteData[a].createdDate - noteData[b].createdDate)
                .map((id) => (
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
                .map((id) => (
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

const CRDTTextarea = ({ sessionId, value, onChange }) => {
    const ref = React.useRef(null);
    const savedValue = React.useRef(value);
    const currentText = rich.toString(value);
    const initial = React.useRef(true);

    const sync = React.useCallback((newValue) => {
        if (newValue === savedValue.current && !initial.current) {
            return;
        }
        if (!ref.current) {
            return;
        }
        const node = ref.current;
        initial.current = false;
        const text = rich.toString(newValue);
        const oldValue = savedValue.current;
        savedValue.current = newValue;
        if (text !== node.value) {
            const start = node.selectionStart;
            const end = node.selectionEnd;
            console.log('setting text value to', text);
            node.value = text;
            try {
                const oldText = rich.toString(oldValue);
                checkConsistency(oldValue);
                checkConsistency(newValue);
                const transformed = rich.adjustSelection(oldValue, newValue, start, end);
                console.log('New selection', transformed);
                node.selectionStart = transformed.start;
                node.selectionEnd = transformed.end;
            } catch (err) {
                console.error(err);
            }
        } else {
            console.log('text already matches', text);
        }
    }, []);

    sync(value);

    return (
        <textarea
            ref={(node) => {
                if (node) {
                    ref.current = node;
                    sync(value);
                }
            }}
            onChange={(e) => {
                const newValue = e.target.value;
                const change = textBinding.inferChange(
                    currentText,
                    newValue,
                    e.target.selectionStart === e.target.selectionEnd
                        ? e.target.selectionStart
                        : null,
                );
                // console.log('>> change inferred <<', change);
                const deltas = [];
                if (change.removed) {
                    deltas.push(
                        rich.del(savedValue.current, change.removed.at, change.removed.len),
                    );
                }
                if (change.added) {
                    deltas.push(
                        rich.insert(
                            savedValue.current,
                            sessionId,
                            change.added.at,
                            change.added.text,
                        ),
                    );
                }
                // console.log('applying', deltas);
                onChange(deltas);
            }}
        />
    );
};

const Note = ({
    id,
    item,
    col,
    sessionId,
}: {
    id: string,
    item: NoteT,
    col: Collection<Note>,
    sessionId: string,
}) => {
    // console.log(item);
    // let currentText = rich.toString(item.body);
    return (
        <div>
            Note
            <div>{item.title || 'Untitled'}</div>
            <div>
                <CRDTTextarea
                    sessionId={sessionId}
                    value={item.body}
                    onChange={(deltas) => col.applyRichTextDelta(id, ['body'], deltas)}
                />
            </div>
        </div>
    );
};

const Item = ({ item, onChange }: { item: Task, onChange: (string, any) => void }) => {
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
                onChange={(evt) => {
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
                    onClick={(evt) => evt.stopPropagation()}
                    onMouseDown={(evt) => {
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
                    onClick={(evt) => {
                        evt.target.selectionStart = 0;
                        evt.target.selectionEnd = evt.target.value.length;
                    }}
                    onChange={(evt) => setText(evt.target.value)}
                    onBlur={() => {
                        setText(null);
                        onChange('title', text);
                    }}
                    onKeyDown={(evt) => {
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
