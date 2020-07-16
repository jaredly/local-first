// @flow
import { Switch, Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
import querystring from 'querystring';
import * as React from 'react';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
} from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from './auth-api';

// import Home from './Home';
import schemas from '../collections';
import Item from './Item';

// import Schedule from './Schedule/Schedule';
// import Split from './Split';
// import Habits from './Habits/Habits';
import { blankItem } from './types';

const genId = () => Math.random().toString(36).slice(2);

export type AuthData = { host: string, auth: Data, logout: () => mixed };

const createClient = (dbName, authData) => {
    const url = `${authData.host}/dbs/sync?db=trees&token=${authData.auth.token}`;
    // if (false) {
    //     return createPollingPersistedDeltaClient(
    //         dbName,
    //         schemas,
    //         `${authData.host.startsWith('localhost:') ? 'http' : 'https'}://${url}`,
    //         3,
    //         {},
    //     );
    // }
    return createPersistedDeltaClient(
        dbName,
        schemas,
        `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
        3,
        {},
    );
    // : createPersistedBlobClient(dbName, schemas, null, 3);
};

const App = ({ dbName, authData }: { dbName: string, authData: AuthData }) => {
    console.log('run app', authData);
    const client = React.useMemo(() => {
        console.log('starting a client', authData);
        return createClient(dbName, authData);
    }, [authData]);

    const [col, items] = useCollection(React, client, 'items');

    const [_, item] = useItem(React, client, 'items', 'root');

    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    return (
        <div>
            Hello folks
            {item === false ? (
                'No item'
            ) : item === null ? (
                'null item'
            ) : (
                <Item id="root" client={client} />
            )}
            {item === null ? (
                <button
                    onClick={() => {
                        const id = 'root';
                        const item = { ...blankItem(), id };
                        col.save(id, item);
                    }}
                >
                    Create a root folks
                </button>
            ) : null}
        </div>
    );
};

export default App;
