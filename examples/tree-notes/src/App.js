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
    const { doc: rawDoc } = useParams();
    const [docId, itemId] = parseRawDoc(rawDoc);
    const client = React.useMemo(() => {
        if (config.type === 'memory') {
            return createInMemoryEphemeralClient(schemas);
        }
        const url = `${config.authData.host}/dbs/sync?db=trees/${docId || 'home'}&token=${
            config.authData.auth.token
        }`;
        return createPersistedDeltaClient(
            config.prefix + (docId ? '/' + docId : ''),
            schemas,
            `${config.authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [config.authData, docId]);
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
                <Items client={client} local={local} col={col} id={itemId} />
                {/* <RouteSwitch>
                    <Route path={`${match.path == '/' ? '' : match.path}/item/:id`}>
                        <Items client={client} local={local} col={col} />
                    </Route>
                    <Route path={`${match.path == '/' ? '' : match.path}`}>
                        <Items client={client} local={local} col={col} />
                    </Route>
                </RouteSwitch> */}
            </AppShell>
            {/* )} */}
            <UpdateSnackbar />
        </div>
    );
};

export default App;
