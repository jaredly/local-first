// @flow
import React from 'react';
import { render } from 'react-dom';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import makeClient from './poll';
import { getCollection, type ClientState } from './client';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);
const client: ClientState<Delta, Data> = (window.client = makeClient(
    genId(),
    crdt,
));

type Tasks = {
    [key: string]: {
        completed: boolean,
        title: string,
        tags: { [key: string]: boolean },
    },
};

const useCollection = (client, name) => {
    const col = React.useMemo(() => getCollection(client, name), []);
    const [data, setData] = React.useState(({}: Tasks));
    React.useEffect(() => {
        col.loadAll().then(data => {
            console.log('loaded all', data);
            console.log(Object.keys(client.collections[name].data));
            setData(a => ({ ...a, ...data }));
            col.onChanges(changes => {
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
