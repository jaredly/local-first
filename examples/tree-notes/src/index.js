// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

import Auth from '../../shared/Auth';
import App from './App';

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
    return (
        <Router>
            <Switch>
                <Route path="/memory">
                    <Main host={null} dbName="tree-notes-memory" storageKey={'Nope folks'} />
                </Route>
                <Route path="/localhost">
                    <Main
                        host={'localhost:9090'}
                        dbName="tree-notes-glitch-2"
                        storageKey={'tree-notes-local'}
                    />
                </Route>
                <Route path="/">
                    <Main
                        host={'local-first-server.glitch.me'}
                        dbName="tree-notes-glitch"
                        storageKey={'tree-notes'}
                    />
                </Route>
            </Switch>
        </Router>
    );
};

const Main = ({
    host,
    dbName,
    storageKey,
}: {
    host: ?string,
    dbName: string,
    storageKey: string,
}) => {
    console.log('main render?');
    if (host == null) {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <App dbName={dbName} authData={null} />
            </ThemeProvider>
        );
    }
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Auth
                storageKey={storageKey}
                host={host}
                render={(auth, logout) => <App dbName={dbName} authData={{ host, auth, logout }} />}
            />
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
