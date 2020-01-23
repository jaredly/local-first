// @flow
import React from 'react';
import { render } from 'react-dom';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import makeClient from './client';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

let sessionId = genId();

// let sessionId = localStorage.getItem('sessionId');
// if (!sessionId) {
//     sessionId = Math.random()
//         .toString(36)
//         .slice(2);
//     localStorage.setItem('sessionId', sessionId);
// }

// let messageQueue = [];
let connected = false;
let socket = new WebSocket('ws://localhost:9900/sync?sessionId=' + sessionId);

socket.addEventListener('open', function() {
    console.log('connected');
    // if (messageQueue) {
    //     messageQueue.forEach(message => socket.send(JSON.stringify(message)));
    // }
    // messageQueue = null;
    connected = true;
});

// Listen for messages
socket.addEventListener('message', function({ data }: { data: any }) {
    client.onMessage(JSON.parse(data));
});

const send = message => {
    if (!connected) {
        console.log('tried to send, but not connected', message);
        return false;
    }
    console.log('sending', message);
    message.forEach(message => {
        socket.send(JSON.stringify(message));
    });
    return true;
};
const client = makeClient(crdt, sessionId, send);

const useCollection = (client, name) => {
    const col = React.useMemo(() => client.getCollection(name), []);
    const [data, setData] = React.useState({});
    React.useEffect(() => {
        col.loadAll().then(data => setData(data));
        col.onChanges(changes => {
            const n = { ...data };
            changes.forEach(({ value, id }) => {
                n[id] = value;
            });
            setData(n);
        });
    }, []);
    return [col, data];
};

const App = () => {
    const [col, data] = useCollection(client, 'tasks');
    // const col = React.useMemo(() => client.getCollection('tasks'));
    // const [data, setData] = React.useState({});
    // React.useEffect(() => {
    //     col.loadAll().then(data => setData(data));
    //     col.onChanges(changes => {
    //         const n = { ...data };
    //         changes.forEach(({ value, id }) => {
    //             n[id] = value;
    //         });
    //         setData(n);
    //     });
    // });
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
