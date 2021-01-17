// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';
import { useRouteMatch } from 'react-router-dom';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

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

const Main = ({ host, prefix }: { host?: ?string, prefix?: ?string }) => {
    if (host == null || prefix == null) {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <Router>
                    <App config={{ type: 'memory' }} />
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
                    render={(authData) => (
                        <Switch>
                            <Route path="/doc/:doc">
                                <App
                                    config={{
                                        type: 'remote',
                                        prefix,
                                        authData,
                                    }}
                                />
                            </Route>
                            <Route path="/">
                                <Docs prefix={prefix} authData={authData} />
                            </Route>
                        </Switch>
                    )}
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
