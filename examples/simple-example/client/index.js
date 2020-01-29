// @flow
import React from 'react';
import { render } from 'react-dom';
import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import { makeNetwork } from './poll';
// import { makeNetwork } from './ws';
import makeClient, {
    getCollection,
    getStamp,
    syncMessages,
    onMessage,
    type ClientState,
    type CursorType,
} from '../fault-tolerant/client';
import { ItemSchema } from '../shared/schema.js';
import makePersistence from './idb-persistence';

const setup = () => {
    const persistence = makePersistence();
    const client = makeClient(persistence, crdt, () => {}, ['tasks']);
    const network = makeNetwork(
        'http://localhost:9900/sync',
        // 'ws://localhost:9104/sync',
        persistence.getHLC().node,
        () => syncMessages(client.persistence, client.collections),
        messages =>
            Promise.all(messages.map(message => onMessage(client, message))),
    );
    client.setDirty = network.sync;
    return { client, onConnection: network.onConnection };
};

const {
    client,
    onConnection,
}: {
    onConnection: *,
    client: ClientState<Delta, Data>,
} = (window.client = setup());

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
                    const id = getStamp(client);
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
