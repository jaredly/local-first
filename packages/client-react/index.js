// @flow
// import React from '../../examples/whiteboard/node_modules/react';

import { type Client, type Collection, type QueryOp } from '../client-bundle';
import deepEqual from 'fast-deep-equal';

export const useSyncStatus = function<SyncStatus>(React: *, client: Client<SyncStatus>) {
    const [status, setStatus] = React.useState(client.getSyncStatus());
    React.useEffect(() => {
        return client.onSyncStatus(status => {
            setStatus(status);
        });
    }, []);
    return status;
};

// TODO: Definitely have the listener logic managed at the collection level,
// so that this is as simple as `collection.listenToItems(keys, items => setItems(items))`
// TODO: test that a new list of IDs gets processed correctly
export const useItems = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    colid: string,
    ids: Array<string>,
): [Collection<T>, ?{ [key: string]: ?T | false }] {
    const col = React.useMemo(() => client.getCollection<T>(colid), []);

    const [items, setItems] = React.useState(() => col.getCachedItems(ids));

    React.useEffect(() => {
        return col.onItemsChange(ids, items => setItems(items))[1];
    }, [ids.join('🎁')]);

    // // TODO something to indicate whether we've loaded from the database yet
    // // also something to indicate whether we've ever synced with a server.
    // const [items, setItems] = React.useState(() => {
    //     const items = {};
    //     let found = false;
    //     ids.forEach(id => {
    //         items[id] = col.getCached(id);
    //         if (items[id] != null) [(found = true)];
    //         if (items[id] == null) {
    //             items[id] = false;
    //         }
    //     });
    //     return found || ids.length === 0 ? items : null;
    // });
    // React.useEffect(() => {
    //     const listeners = ids.filter(Boolean).map(id => {
    //         if (!items || !items[id]) {
    //             col.load(id).then(
    //                 data => {
    //                     setItems(items => ({ ...items, [id]: data }));
    //                 },
    //                 /* istanbul ignore next */
    //                 err => {
    //                     console.error('Unable to load item!', id);
    //                     console.error(err);
    //                 },
    //             );
    //         }
    //         return col.onItemChange(id, data => setItems(items => ({ ...items, [id]: data })));
    //     });
    //     return () => listeners.forEach(fn => fn());
    // }, [ids.join('🎁')]);
    return [col, items];
};

export const useItem = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    colid: string,
    id: string,
): [Collection<T>, ?T | false] {
    const col = React.useMemo(() => client.getCollection<T>(colid), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [item, setItem] = React.useState(() => {
        const data = col.getCached(id);
        if (data == null) {
            return false;
        }
        return data;
    });
    const currentData = React.useRef(item);
    currentData.current = item;
    React.useEffect(() => {
        if (item == null || item === false || id !== item.id) {
            if (item) {
                const newCached = col.getCached(id);
                if (newCached != null) {
                    setItem(newCached);
                    return col.onItemChange(id, setItem);
                } else {
                    // loading state
                    // console.log('switch! reloading', id, item.id);
                    setItem(false);
                }
            }
            col.load(id).then(
                data => {
                    setItem(data);
                },
                /* istanbul ignore next */
                err => {
                    // console.error('Unable to load item!', id);
                    console.error(err);
                },
            );
        }
        return col.onItemChange(id, item => {
            try {
                if (!deepEqual(item, currentData.current)) {
                    setItem(item);
                }
            } catch (_) {
                // Assume it was deepEqual being mad
                setItem(item);
            }
        });
    }, [id]);
    return [col, item];
};

/*

sharedCollection:
so that loadAll doesn't hit persistence & create all new objects.

*/

// Ok I want it to: give me the realized cache
// and allow me to add a cache listener
// so like,
// if you don't have the cache ready, start it up
// I think I want a little cache manager or something.

export const useCollection = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    name: string,
): [Collection<T>, { [key: string]: T }] {
    // Hmm maybe collections should be cached?
    const col = React.useMemo(() => client.getCollection<T>(name), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [data, setData] = React.useState(
        () => {
            const all = col.getAllCached();
            // TODO: return null here, so we can know that things just haven't loaded
            // if (Object.keys(all).length === 0) {
            //     return null;
            // }
            return all;
            // return {};
        },
        // ({}: { [key: string]: T })
    );
    const currentData = React.useRef(data);
    currentData.current = data;
    React.useEffect(() => {
        col.loadAll().then(data => {
            // TODO: if there aren't any changes, then don't mess with it.
            let changed = Object.keys(data).some(k => !deepEqual(data[k], currentData.current[k]));
            // console.log('COL CHANGES', name, data);
            if (changed) {
                setData(a => ({ ...a, ...data }));
            }
            // OH NO, there's a race!!! It's possible to miss changes here
            // ... hmm....
            col.onChanges(changes => {
                // ugh. neeeeed to dedup here.
                const changed = changes.some(({ value, id }) => {
                    if (value) {
                        return !deepEqual(value, currentData.current[id]);
                    } else {
                        return currentData.current[id] != null;
                    }
                });
                if (changed) {
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
                }
            });
        });
    }, []);
    return [col, data];
};

export const useQuery = function<T: {}, SyncStatus>(
    React: *,
    client: Client<SyncStatus>,
    name: string,
    key: string,
    op: QueryOp,
    value: any,
): [Collection<T>, Array<{ key: string, value: T }>] {
    // Hmm maybe collections should be cached?
    const col = React.useMemo(() => client.getCollection<T>(name), []);
    // TODO something to indicate whether we've loaded from the database yet
    // also something to indicate whether we've ever synced with a server.
    const [results, setResults] = React.useState([]);
    React.useEffect(() => {
        col.query(key, op, value).then(results => {
            setResults(results);
            col.onQueryChanges(key, op, value, (added, removed) => {
                setResults(results => {
                    results = results.filter(res => !removed.includes(res.key));
                    // STOPSHIP: Do I care about ordering here?
                    return results.concat(added);
                });
            });
        });
    }, []);
    return [col, results];
};
