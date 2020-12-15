// @flow
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import querystring from 'querystring';
import ListItem from '@material-ui/core/ListItem';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import * as React from 'react';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
    createInMemoryEphemeralClient,
} from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from '../../shared/auth-api';
import type { AuthData } from '../../shared/Auth';

import schemas from '../collections';
import LocalClient from './LocalClient';
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Items from './Items';

import { Switch as RouteSwitch } from 'react-router-dom';

type ConnectionConfig =
    | {
          type: 'memory',
      }
    | {
          type: 'remote',
          host: string,
          docName: string,
          autoData: AuthData,
      };

const App = ({ dbName, authData }: { dbName: string, authData: ?AuthData }) => {
    const client = React.useMemo(() => {
        console.log('starting a client', authData);
        if (!authData) {
            const mem = createInMemoryEphemeralClient(schemas);
            window.inMemoryClient = mem;
            return mem;
        }
        const url = `${authData.host}/dbs/sync?db=trees&token=${authData.auth.token}`;
        return createPersistedDeltaClient(
            dbName,
            schemas,
            `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [authData]);
    const match = useRouteMatch();
    const local = React.useMemo(() => new LocalClient('tree-notes'), []);
    window.client = client;
    const [col, items] = useCollection(React, client, 'items');
    const [_, item] = useItem(React, client, 'items', 'root');

    return (
        <div>
            <AppShell
                title="Tree notes"
                Drawer={Drawer}
                drawerItems={null}
                authData={authData}
                client={client}
            >
                <RouteSwitch>
                    <Route path={`${match.path == '/' ? '' : match.path}/item/:id`}>
                        <Items client={client} local={local} col={col} />
                    </Route>
                    <Route path={`${match.path == '/' ? '' : match.path}`}>
                        <Items client={client} local={local} col={col} />
                    </Route>
                </RouteSwitch>
            </AppShell>
            {/* )} */}
            <UpdateSnackbar />
        </div>
    );
};

export default App;
