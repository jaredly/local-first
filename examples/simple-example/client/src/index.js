// @flow
import React from 'react';
import { render } from 'react-dom';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    syncFailed,
    syncSucceeded,
    debounce,
} from './client';
import backOff from './back-off';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

const sync = async client => {
    const messages = syncMessages(client.collections);
    console.log('messages', messages);
    const res = await fetch(
        `http://localhost:9900/sync?sessionId=${client.sessionId}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
        },
    );
    if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
    }
    syncSucceeded(client.collections);
    const data = await res.json();
    data.forEach(message => onMessage(client, message));
};

const client = makeClient<Delta, Data>(
    crdt,
    genId(),
    debounce(() =>
        backOff(() =>
            sync(client).then(
                () => true,
                err => {
                    syncFailed(client.collections);
                    return false;
                },
            ),
        ),
    ),
    ['tasks'],
);
window.client = client;

const useCollection = (client, name) => {
    const col = React.useMemo(() => getCollection(client, name), []);
    const [data, setData] = React.useState({});
    React.useEffect(() => {
        col.loadAll().then(data => {
            console.log('loaded all', data);
            console.log(Object.keys(client.collections[name].data));
            setData(a => ({ ...a, ...data }));
            col.onChanges(changes => {
                setData(data => {
                    const n = { ...data };
                    changes.forEach(({ value, id }) => {
                        n[id] = value;
                    });
                    return n;
                });
            });
        });
    }, []);
    return [col, data];
};

const App = () => {
    const [col, data] = useCollection(client, 'tasks');
    return (
        <div>
            Hello
            {JSON.stringify(data)}
            <button
                onClick={() => {
                    const id = genId();
                    col.save(id, {
                        title: 'Item ' + (Object.keys(data).length + 1),
                        completed: false,
                        tags: {},
                    });
                }}
            >
                Add a thing
            </button>
        </div>
    );
};

const root = document.getElementById('root');
if (root) {
    render(<App />, root);
}
