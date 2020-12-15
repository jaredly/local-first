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
          dbName: string,
          autoData: AuthData,
      };

const App = ({ config }: { config: ConnectionConfig }) => {
    const client = React.useMemo(() => {
        if (config.type === 'memory') {
            return createInMemoryEphemeralClient(schemas);
        }
        const url = `${config.authData.host}/dbs/sync?db=trees&token=${config.authData.auth.token}`;
        return createPersistedDeltaClient(
            config.dbName,
            schemas,
            `${config.authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [config.authData]);
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
                authData={config.authData}
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
