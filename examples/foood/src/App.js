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
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Editor from './Editor';

import { Switch as RouteSwitch } from 'react-router-dom';

export type ConnectionConfig =
    | {
          type: 'memory',
      }
    | {
          type: 'remote',
          prefix: string,
          authData: AuthData,
      };

const parseRawDoc = (rawDoc) => {
    if (!rawDoc || !rawDoc.trim().length) {
        return [null, null];
    }
    const parts = rawDoc.split(':');
    if (parts.length === 1) {
        return [rawDoc, null];
    }
    return [parts[0], parts[1]];
};

const App = ({ config }: { config: ConnectionConfig }) => {
    const client = React.useMemo(() => {
        if (config.type === 'memory') {
            return createInMemoryEphemeralClient(schemas);
        }
        const url = `${config.authData.host}/dbs/sync?db=foood&token=${config.authData.auth.token}`;
        return createPersistedDeltaClient(
            config.prefix,
            schemas,
            `${config.authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [config.type === 'remote' ? config.authData : null]);
    React.useEffect(() => {
        if (config.type !== 'remote') {
            return;
        }
        return config.authData.onLogout(() => {
            client.teardown();
        });
    }, [client, config.type === 'remote' ? config.authData : null]);
    const match = useRouteMatch();

    const authData = config.type === 'remote' ? config.authData : null;

    window.client = client;
    const [col, recipes] = useCollection(React, client, 'recipes');
    const [_, homepage] = useItem(React, client, 'settings', 'home');

    const pathPrefix = match.path == '/' ? '' : match.path;

    return (
        <div>
            <AppShell
                title="Foood"
                renderDrawer={(isOpen, onClose) => (
                    <Drawer
                        pageItems={null}
                        onClose={onClose}
                        open={isOpen}
                        authData={authData}
                        client={client}
                    />
                )}
                drawerItems={null}
                authData={authData}
                client={client}
            >
                {/* <Items client={client} local={local} col={col} id={itemId} /> */}
                <RouteSwitch>
                    <Route path={`${pathPrefix}/recipe/new`}>
                        {/* Make a recipe */}
                        <Editor />
                        {/* <Items client={client} local={local} col={col} /> */}
                    </Route>
                    <Route path={`${pathPrefix}/recipe/:id`}>
                        Hello repo
                        {/* <Items client={client} local={local} col={col} /> */}
                    </Route>
                    <Route path={`${pathPrefix}`}>
                        It's the home slice
                        {/* <Items client={client} local={local} col={col} /> */}
                    </Route>
                </RouteSwitch>
            </AppShell>
            {/* )} */}
            <UpdateSnackbar />
        </div>
    );
};

export default App;
