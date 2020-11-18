// @flow
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
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
} from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from './auth-api';

import schemas from '../collections';
import Item from './Item';
import LocalClient from './LocalClient';
import { type DropTarget } from './dragging';
import AppShell from './AppShell';

import { Switch as RouteSwitch } from 'react-router-dom';

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

type Dest =
    | {
          type: 'before',
          path: Array<string>,
      }
    | {
          type: 'child',
          path: Array<string>,
      }
    | {
          type: 'after',
          path: Array<string>,
      };
export type DragTarget = DropTarget<Dest>;

const useDragging = () => {
    const targetMakers = React.useMemo(() => ({}), []);
    const onDragStart = (evt, path) => {
        evt.preventDefault();
        evt.stopPropagation();
        const targets = [].concat(...Object.keys(targetMakers).map((id) => targetMakers[id](path)));
        console.log('oh starting to drag, here we are', targets);
        // return [];
    };
    const registerDragTargets = (id, cb) => {
        if (!cb) {
            delete targetMakers[id];
        } else {
            targetMakers[id] = cb;
        }
    };
    return { onDragStart, registerDragTargets };
};

const Items = ({ client, local }) => {
    const { registerDragTargets, onDragStart } = useDragging();
    const { id } = useParams();

    return (
        <Item
            path={[]}
            id={id || 'root'}
            client={client}
            local={local}
            registerDragTargets={registerDragTargets}
            onDragStart={onDragStart}
        />
    );
};

const App = ({ dbName, authData }: { dbName: string, authData: AuthData }) => {
    const client = React.useMemo(() => {
        console.log('starting a client', authData);
        return createClient(dbName, authData);
    }, [authData]);
    const match = useRouteMatch();

    const local = React.useMemo(() => new LocalClient('tree-notes'), []);

    window.client = client;

    const [col, items] = useCollection(React, client, 'items');

    const [_, item] = useItem(React, client, 'items', 'root');

    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    return (
        <div>
            {item === false ? (
                'Not loaded'
            ) : item === null ? (
                <button
                    onClick={() => {
                        const id = 'root';
                        const item = { ...blankItem(), id };
                        col.save(id, item);
                        console.log('saving');
                    }}
                >
                    Create a root folks
                </button>
            ) : (
                <AppShell
                    drawerItems={
                        // <ListItem>
                        //     <FormControlLabel
                        //         control={
                        //             <Switch
                        //                 checked={showAll}
                        //                 onChange={() => setShowAll(!showAll)}
                        //                 color="primary"
                        //             />
                        //         }
                        //         label="Show completed"
                        //     />
                        // </ListItem>
                        null
                    }
                    authData={authData}
                    // auth={auth}
                    // host={host}
                    // logout={logout}
                    client={client}
                >
                    <RouteSwitch>
                        <Route path={`${match.path == '/' ? '' : match.path}/item/:id`}>
                            <Items client={client} local={local} />
                        </Route>
                        <Route path={`${match.path == '/' ? '' : match.path}`}>
                            <Items client={client} local={local} />
                        </Route>
                    </RouteSwitch>
                </AppShell>
            )}
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={showUpgrade}
                autoHideDuration={6000}
                onClose={() => setShowUpgrade(false)}
                message="Update available"
                action={
                    <React.Fragment>
                        <Button
                            color="secondary"
                            size="small"
                            onClick={() => {
                                window.upgradeAvailable.waiting.postMessage({
                                    type: 'SKIP_WAITING',
                                });
                                setShowUpgrade(false);
                            }}
                        >
                            Reload
                        </Button>
                        <IconButton
                            size="small"
                            aria-label="close"
                            color="inherit"
                            onClick={() => setShowUpgrade(false)}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </React.Fragment>
                }
            />
        </div>
    );
};

export default App;
