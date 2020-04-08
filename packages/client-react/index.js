// @flow
// import React from '../../examples/whiteboard/node_modules/react';

import { type Client } from '../client-bundle';

export const useSyncStatus = function<SyncStatus>(React: *, client: Client<SyncStatus>) {
    const [status, setStatus] = React.useState(client.getSyncStatus());
    React.useEffect(() => {
        return client.onSyncStatus((status) => {
            console.log('status', status);
            setStatus(status);
        });
    }, []);
    return status;
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
        col.loadAll().then((data) => {
            setData((a) => ({ ...a, ...data }));
            col.onChanges((changes) => {
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
