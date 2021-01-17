// @flow
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import { toString as richTextToString } from '../../../packages/rich-text-crdt';
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

import schemas, { type ItemT } from '../collections';
import { schemas as indexSchemas, type File } from '../index-collections';
import LocalClient from './LocalClient';
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Items from './Items';
import { blankItem } from './types';
import Debug from '../../shared/Debug';

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

const populateWithInitialData = (client) => {
    const col = client.getCollection('items');
    const makeNode = (node) => {
        const id = col.genId();
        if (typeof node === 'string') {
            col.save(id, {
                ...blankItem(node),
                id,
            });
        } else {
            const children = node.children.map(makeNode);
            col.save(id, {
                ...blankItem(node.text),
                id,
                children,
            });
        }
        return id;
    };

    const initialData = [
        'Hello',
        'My good folks',
        'Here we are',
        'Is it not grand',
        {
            text: 'A parent',
            children: [
                'Child one',
                'Child two',
                'A very long thing that has a number of words going on here.',
            ],
        },
    ];
    for (let i = 0; i < 100; i++) {
        initialData.push(`Long child ${i}`);
    }
    // const children = [];
    // initialData.forEach
    //     const id = col.genId();
    //     col.save(id, {
    //         ...blankItem(`Child ${i}`),
    //         id,
    //     });
    //     children.push(id);
    // }

    col.save('root', {
        ...blankItem('Hello world'),
        id: 'root',
        children: initialData.map(makeNode),
    });
    return client;
};

const App = ({ config }: { config: ConnectionConfig }) => {
    const { doc: docId } = useParams();
    // const [docId, itemId] = parseRawDoc(rawDoc);
    const dbName =
        config.type === 'remote' ? config.prefix + '/' + (docId || 'home') : 'memory-' + docId;

    // STOPSHIP: Use the index-collections, and make it so we can be multi-file!!
    // So good.
    // I think this means that I don't need a "default file" anymore?
    // I can just show the index. Yeah I like that.
    const docClient = React.useMemo(() => {
        console.log('🔥 Creating the index client');
        if (config.type === 'memory') {
            return populateWithInitialData(createInMemoryEphemeralClient(schemas));
        }
        const url = `${config.authData.host}/dbs/sync?db=trees-index&token=${config.authData.auth.token}`;
        return createPersistedDeltaClient(
            config.prefix + '-index',
            indexSchemas,
            `${config.authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [config.type === 'remote' ? config.authData : null]);

    const client = React.useMemo(() => {
        console.log('🔥 Creating the client');
        if (config.type === 'memory') {
            return populateWithInitialData(createInMemoryEphemeralClient(schemas));
        }
        const url = `${config.authData.host}/dbs/sync?db=trees/${docId || 'home'}&token=${
            config.authData.auth.token
        }`;
        return createPersistedDeltaClient(
            dbName,
            schemas,
            `${config.authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
            3,
            {},
        );
    }, [config.type === 'remote' ? config.authData : null, docId]);

    const [docCol, file] = useItem<File, _>(React, docClient, 'files', docId || 'home');

    // React.useEffect(() => {
    //     const id = docId || 'home';
    //     const files = docClient.getCollection('files');
    //     files.setAttribute(id, ['lastOpened'], Date.now());
    // }, [docClient, docId]);

    React.useEffect(() => {
        if (file === false || file == null) {
            return;
        }
        docCol.setAttribute(file.id, ['lastOpened'], Date.now());
    }, [docClient, docId, file !== false && file != null]);

    React.useEffect(() => {
        if (config.type !== 'remote') {
            return;
        }
        return config.authData.onLogout(() => {
            client.teardown();
            docClient.teardown();
        });
    }, [docClient, client, config.type === 'remote' ? config.authData : null]);

    const match = useRouteMatch();
    const local = React.useMemo(() => new LocalClient(dbName, config.type === 'memory'), [
        config.type,
    ]);

    React.useEffect(() => {
        if (config.type !== 'remote') {
            // lets expand all the things!
            client
                .getCollection('items')
                .loadAll()
                .then((all) => {
                    Object.keys(all).forEach((id) => local.setExpanded(id, true));
                });
            return;
        }
        return config.authData.onLogout(() => local.teardown());
    }, [local, config.type === 'remote' ? config.authData : null]);

    const [_, rootItem] = useItem<ItemT, _>(React, client, 'items', 'root');
    React.useEffect(() => {
        // console.log('EFFFFECT');
        if (!rootItem) {
            return;
        }
        let text = richTextToString(rootItem.body);
        if (text.length > 50) {
            text = text.slice(0, 47) + '...';
        }
        if (file != null && file !== false && file.title !== text) {
            docCol.setAttribute(file.id, ['title'], text);
        }
    }, [
        rootItem != null && rootItem !== false ? rootItem.body : null,
        file != null && file !== false ? file.title : null,
    ]);

    window.client = client;

    return (
        <div>
            <AppShell
                title="Tree notes"
                renderDrawer={(isOpen, onClose) => (
                    <Drawer
                        pageItems={null}
                        onClose={onClose}
                        open={isOpen}
                        authData={config.type === 'remote' ? config.authData : null}
                        client={client}
                    />
                )}
                Drawer={Drawer}
                drawerItems={null}
                authData={config.type === 'remote' ? config.authData : null}
                client={client}
            >
                <RouteSwitch>
                    <Route path={`${match.path == '/' ? '' : match.path}/debug`}>
                        <Debug client={client} />
                    </Route>
                    <Route path={`${match.path == '/' ? '' : match.path}/item/:path`}>
                        <Items client={client} local={local} />
                    </Route>
                    <Route path={`${match.path == '/' ? '' : match.path}`}>
                        <Items client={client} local={local} />
                    </Route>
                </RouteSwitch>
            </AppShell>
            {/* )} */}
            <UpdateSnackbar />
        </div>
    );
};

export default App;
