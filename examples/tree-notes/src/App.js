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
    createInMemoryEphemeralClient,
} from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from './auth-api';

import schemas from '../collections';
import Item from './Item';
import LocalClient from './LocalClient';
import { type DropTarget } from './dragging';
import AppShell from './AppShell';
import { setupDragListeners, type DragInit, type DragState } from './dragging';

import { Switch as RouteSwitch } from 'react-router-dom';

import { blankItem } from './types';

const genId = () => Math.random().toString(36).slice(2);

export type AuthData = { host: string, auth: Data, logout: () => mixed };

const createClient = (dbName, authData) => {
    if (!authData) {
        const mem = createInMemoryEphemeralClient(schemas);
        window.inMemoryClient = mem;
        return mem;
    }
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

const useDragging = (onDrop) => {
    const targetMakers = React.useMemo(() => ({}), []);

    const [dragger, setDragger] = React.useState((null: ?DragState<Dest>));
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    const onDragStart = React.useCallback((evt, path) => {
        if (evt.button !== 0) {
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        const targets = [].concat(...Object.keys(targetMakers).map((id) => targetMakers[id](path)));
        targets.sort((a, b) => a.top - b.top);
        console.log(targets);
        setDragger({
            dragging: {
                pos: { x: evt.clientX, y: evt.clientY },
                path,
            },
            started: false,
            dest: null,
            dims: null,
            targets,
            path,
        });
    }, []);

    React.useEffect(() => {
        if (dragger != null) {
            return setupDragListeners(
                dragger.targets,
                currentDragger,
                false,
                setDragger,
                (dragInit, dest) => {
                    onDrop(dragInit, dest);
                },
            );
        }
    }, [!!dragger]);

    const registerDragTargets = React.useCallback((id, cb) => {
        if (!cb) {
            delete targetMakers[id];
        } else {
            targetMakers[id] = cb;
        }
    }, []);
    return { onDragStart, registerDragTargets, dragger };
};

const emptyPath = [];

const Items = ({ client, local, col }) => {
    const onDrop = React.useCallback(({ path }, dest) => {
        const id = path[path.length - 1];
        const pid = path[path.length - 2];
        if (!pid) {
            return;
        }
        console.log('drop it here', path, dest);
        col.removeId(pid, ['children'], id);
        if (dest.type === 'after' || dest.type === 'before') {
            const npid = dest.path[dest.path.length - 2];
            const nrel = dest.path[dest.path.length - 1];
            if (!npid) {
                return;
            }
            col.insertIdRelative(npid, ['children'], id, nrel, dest.type === 'before');
            local.setExpanded(npid, true);
        } else {
            const npid = dest.path[dest.path.length - 1];
            col.insertId(npid, ['children'], 0, id);
            local.setExpanded(npid, true);
        }
        local.setFocus(id);
    }, []);
    const { registerDragTargets, onDragStart, dragger } = useDragging(onDrop);
    const { id } = useParams();

    return (
        <React.Fragment>
            <Item
                path={emptyPath}
                id={id || 'root'}
                client={client}
                local={local}
                registerDragTargets={registerDragTargets}
                onDragStart={onDragStart}
            />
            {dragger != null && dragger.dims != null && dragger.dest != null ? (
                <div
                    // className={styles.dragIndicator}
                    style={{
                        position: 'absolute',
                        // height: 2,
                        // marginTop: -2,
                        // backgroundColor: theme.palette.warning.dark,
                        backgroundColor: 'red',
                        opacity: 0.5,
                        mouseEvents: 'none',
                        // transition: `transform ease .1s`,
                        left: dragger.dims.left,
                        width: dragger.dims.width,
                        height: dragger.dims.height, // + 4,
                        transform: `translateY(${dragger.dims.top}px)`,
                        top: 0,
                    }}
                ></div>
            ) : null}
        </React.Fragment>
    );
};

const App = ({ dbName, authData }: { dbName: string, authData: ?AuthData }) => {
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
