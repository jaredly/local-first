// @flow
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import querystring from 'querystring';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Button from '@material-ui/core/Button';
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

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

// import schemas from '../collections';
import { schemas as indexSchemas, type File } from '../index-collections';
import LocalClient from './LocalClient';
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Items from './Items';
import { blankItem } from './types';
import Debug from '../../shared/Debug';

import { Switch as RouteSwitch } from 'react-router-dom';
import { type ConnectionConfig } from './App';

const Docs = ({ prefix, authData }: { prefix: string, authData: AuthData }) => {
    const { doc: docId } = useParams();

    // STOPSHIP: Use the index-collections, and make it so we can be multi-file!!
    // So good.
    // I think this means that I don't need a "default file" anymore?
    // I can just show the index. Yeah I like that.
    const docClient = React.useMemo(() => {
        console.log('🔥 Creating the index client');
        const url = `${authData.host}/dbs/sync?db=trees-index&token=${authData.auth.token}`;
        return createPersistedDeltaClient(
            prefix + '-index',
            indexSchemas,
            `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [authData]);

    React.useEffect(() => {
        return authData.onLogout(() => {
            docClient.teardown();
        });
    }, [docClient, authData]);

    // const match = useRouteMatch();

    const [col, files] = useCollection<File, _>(React, docClient, 'files');

    return (
        <div>
            <AppShell
                title="Tree notes"
                renderDrawer={(isOpen, onClose) => (
                    <Drawer
                        pageItems={null}
                        onClose={onClose}
                        open={isOpen}
                        authData={authData}
                        client={docClient} // TODO?
                    />
                )}
                Drawer={Drawer}
                drawerItems={null}
                authData={authData}
                client={docClient} // TODO?
            >
                <h2 style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Files
                    <Button
                        onClick={() => {
                            const id = col.genId();
                            col.save(id, {
                                id,
                                source: {
                                    url: `${authData.host}/dbs/sync?db=trees/home`,
                                    type: 'delta',
                                },
                                title: 'New Document',
                                lastOpened: Date.now(),
                                lastModified: Date.now(),
                                nodeCount: 0,
                            });
                            // STOPSHIP:
                            // Create now document, connect to a client,
                            // and create a root node folks.
                        }}
                        variant="contained"
                    >
                        New
                    </Button>
                </h2>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Title</TableCell>
                                <TableCell>Last opened</TableCell>
                                <TableCell>Node count</TableCell>
                            </TableRow>
                        </TableHead>
                        {Object.keys(files).map((fileid) => (
                            <TableRow key={fileid}>
                                <TableCell>
                                    {/* <ListItem
                                    key={fileid}
                                    component={Link}
                                > */}
                                    <Link style={{ color: 'inherit' }} to={`/doc/${fileid}`}>
                                        <ListItemText primary={files[fileid].title} />
                                    </Link>
                                    {/* {JSON.stringify(files[fileid])} */}
                                    {/* </ListItem> */}
                                </TableCell>
                                <TableCell>
                                    {new Date(files[fileid].lastOpened).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{files[fileid].nodeCount}</TableCell>
                            </TableRow>
                        ))}
                    </Table>
                </TableContainer>
                {Object.keys(files).length === 0 ? (
                    <Button
                        onClick={() => {
                            col.save('home', {
                                id: 'home',
                                source: {
                                    url: `${authData.host}/dbs/sync?db=trees/home`,
                                    type: 'delta',
                                },
                                title: 'Home',
                                lastOpened: Date.now(),
                                lastModified: Date.now(),
                                nodeCount: 0,
                            });
                        }}
                    >
                        HACK: Add a "home" doc
                    </Button>
                ) : null}
            </AppShell>
            <UpdateSnackbar />
        </div>
    );
};

export default Docs;
