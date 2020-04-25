// @flow
// import React from '../../examples/whiteboard/node_modules/react';

import { type Client, type Collection } from '../client-bundle';

export const useSyncStatus = function<SyncStatus>(React: *, client: Client<SyncStatus>) {
    const [status, setStatus] = React.useState(client.getSyncStatus());
    React.useEffect(() => {
        return client.onSyncStatus(status => {
            console.log('status', status);
            setStatus(status);
        });
    }, []);
    return status;
};

export const useItems = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    colid: string,
    ids: Array<string>,
): [Collection<T>, { [key: string]: ?T }] {
    const col = React.useMemo(() => client.getCollection<T>(colid), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [items, setItems] = React.useState(() => {
        const items = {};
        ids.forEach(id => (items[id] = col.getCached(id)));
        return items;
    });
    React.useEffect(() => {
        const listeners = ids.map(id => {
            if (!items[id]) {
                col.load(id).then(data => {
                    setItems(items => ({ ...items, [id]: data }));
                });
            }
            return col.onItemChange(id, data => setItems(items => ({ ...items, [id]: data })));
        });
        return () => listeners.forEach(fn => fn());
    }, [ids]);
    return [col, items];
};

export const useItem = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    colid: string,
    id: string,
): [Collection<T>, ?T] {
    const col = React.useMemo(() => client.getCollection<T>(colid), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [item, setItem] = React.useState(col.getCached(id));
    React.useEffect(() => {
        if (item == null || id !== item.id) {
            if (item) {
                setItem(null);
            }
            col.load(id).then(data => {
                setItem(data);
            });
        }
        return col.onItemChange(id, setItem);
    }, [id]);
    return [col, item];
};

export const useCollection = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    name: string,
) {
    const col = React.useMemo(() => client.getCollection<T>(name), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [data, setData] = React.useState(({}: { [key: string]: T }));
    React.useEffect(() => {
        col.loadAll().then(data => {
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
