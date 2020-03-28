// @flow
import React from 'react';

import { type Client } from '../client-bundle';

export const useCollection = function<T: {}>(
    client: Client<mixed>,
    name: string,
) {
    const col = React.useMemo(() => client.getCollection<T>(name), []);
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
