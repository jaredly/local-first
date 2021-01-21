// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';
import { useRouteMatch } from 'react-router-dom';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

import {
    teardownDeltaPersistence,
    localStorageClockPersist,
} from '../../../packages/client-bundle';
import Auth from '../../shared/Auth';
import App, { type ConnectionConfig } from './App';
import Docs from './Docs';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',

        primary: { main: '#2196f3' },
        secondary: {
            main: '#ffea00',
        },
    },
});

const Top = () => {
    switch (window.localStorage.treeNotesLocal) {
        case 'memory':
            return <Main host={null} />;
        case 'local':
            return <Main host={'localhost:9090'} prefix={'tree-notes-local'} />;
        default:
            return <Main host={'local-first-server.glitch.me'} prefix={'tree-notes'} />;
    }
};

import { memoWithTeardown } from './App';
import { schemas as indexSchemas, type File } from '../index-collections';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
    createInMemoryEphemeralClient,
    type Client,
} from '../../../packages/client-bundle';

const InMemory = ({ prefix }) => {
    const docClient = memoWithTeardown(
        () => {
            console.log('🔥 Creating the in-memory index client');
            return createInMemoryEphemeralClient(indexSchemas);
        },
        (client) => client.close(),
        [],
    );

    return <App docClient={docClient} config={{ type: 'memory' }} />;
};

const Authed = ({ authData, prefix, host }) => {
    const docClient = memoWithTeardown(
        () => {
            console.log('🔥 Creating the index client');
            const url = `${authData.host}/dbs/sync?db=trees-index&token=${authData.auth.token}`;
            return createPersistedDeltaClient(
                prefix + '-index',
                indexSchemas,
                `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${url}`,
                3,
                {},
            );
        },
        (client) => client.close(),
        [authData],
    );

    React.useEffect(() => {
        return authData.onLogout(async () => {
            const files = await docClient.getCollection('files').loadAll();
            for (let docId of Object.keys(files)) {
                const dbName = prefix + '/' + docId;
                await teardownDeltaPersistence(dbName);
                localStorageClockPersist(dbName).teardown();
            }

            docClient.teardown();
        });
    }, [docClient, authData]);

    return (
        <Switch>
            <Route path="/doc/:doc">
                <App
                    docClient={docClient}
                    config={{
                        type: 'remote',
                        prefix,
                        authData,
                    }}
                />
            </Route>
            <Route path="/">
                <Docs prefix={prefix} docClient={docClient} authData={authData} />
            </Route>
        </Switch>
    );
};

const Main = ({ host, prefix }: { host?: ?string, prefix?: ?string }) => {
    if (host == null || prefix == null) {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <Router>
                    <InMemory prefix={prefix} />
                </Router>
            </ThemeProvider>
        );
    }
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Router>
                <Auth
                    storageKey={prefix + '/auth'}
                    host={host}
                    render={(authData) =>
                        authData ? (
                            <Authed authData={authData} prefix={prefix} host={host} />
                        ) : (
                            'Logged out'
                        )
                    }
                />
            </Router>
        </ThemeProvider>
    );
};

const run = () => {
    const node = document.createElement('div');
    if (!document.body) {
        return;
    }
    document.body.appendChild(node);
    render(<Top />, node);
};

export default run;
