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
    type Client,
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

import schemas from '../collections';
import { schemas as indexSchemas, type File } from '../index-collections';
import LocalClient from './LocalClient';
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Items from './Items';
import { blankItem } from './types';
import Debug from '../../shared/Debug';

import { Switch as RouteSwitch } from 'react-router-dom';
import { type ConnectionConfig, memoWithTeardown } from './App';

const Docs = ({
    prefix,
    authData,
    docClient,
}: {
    docClient: Client<*>,
    prefix: string,
    authData: AuthData,
}) => {
    const { doc: docId } = useParams();

    window.docClient = docClient;

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
                            const id = col.genId().replace(/:/g, '_');
                            const title = 'New Document ' + Object.keys(files).length;
                            col.save(id, {
                                id,
                                source: {
                                    url: `${authData.host}/dbs/sync?db=trees/${id}`,
                                    type: 'delta',
                                },
                                title,
                                lastOpened: Date.now(),
                                lastModified: Date.now(),
                                nodeCount: 0,
                            });

                            const dbName = prefix + '/' + id;
                            const url = `${authData.host}/dbs/sync?db=trees/${id || 'home'}&token=${
                                authData.auth.token
                            }`;
                            const newClient = createPersistedDeltaClient(
                                dbName,
                                schemas,
                                `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
                                3,
                                {},
                            );
                            newClient
                                .getCollection('items')
                                .save('root', {
                                    ...blankItem(title),
                                    id: 'root',
                                })
                                .then(() => newClient.close());
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
                                <TableCell>Last modified</TableCell>
                                <TableCell>Node count</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.keys(files)
                                .sort((a, b) => files[b].lastModified - files[a].lastModified)
                                .map((fileid) => (
                                    <TableRow key={fileid}>
                                        <TableCell>
                                            <Link
                                                style={{ color: 'inherit' }}
                                                to={`/doc/${fileid}`}
                                            >
                                                <ListItemText
                                                    primary={
                                                        files[fileid].title.trim() || 'Untitled'
                                                    }
                                                />
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                files[fileid].lastModified,
                                            ).toLocaleDateString()}{' '}
                                            {new Date(
                                                files[fileid].lastModified,
                                            ).toLocaleTimeString()}
                                        </TableCell>
                                        <TableCell>{files[fileid].nodeCount}</TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
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
