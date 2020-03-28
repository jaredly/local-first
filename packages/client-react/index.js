// @flow
import React from 'react';

const useCollection = function<T: {}>(client, name) {
    const col = React.useMemo(() => client.getCollection(name), []);
    const [data, setData] = React.useState(({}: { [key: string]: T }));
    React.useEffect(() => {
        col.loadAll().then(data => {
            // console.log('loaded all', data);
            setData(a => ({ ...a, ...data }));
            col.onChanges(changes => {
                // console.log('changes', changes);
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
