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

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',

        primary: {
            main:
                window.localStorage.useLocalFoood === 'true' && location.hostname === 'localhost'
                    ? '#673ab7'
                    : '#ff9800',
        },
        secondary: {
            // main: '#ffea00',
            main: '#00e5ff',
        },
    },
});

const Main = ({ host, prefix }: { host?: ?string, prefix?: ?string }) => {
    console.log('main render?', host);
    const match = useRouteMatch();
    if (host == null || prefix == null) {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <App config={{ type: 'memory' }} />
            </ThemeProvider>
        );
    }
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Auth
                storageKey={prefix + '/auth'}
                host={host}
                render={(authData) => (
                    <App
                        config={{
                            type: 'remote',
                            prefix,
                            authData,
                        }}
                    />
                )}
            />
        </ThemeProvider>
    );
};

const Top = () => {
    const useLocal = window.localStorage.useLocalFoood === 'true';
    return (
        <Router>
            <Switch>
                {/* <Route path="/memory">
                    <Main host={null} />
                </Route>
                <Route path="/localhost">
                    <Main host={'localhost:9090'} prefix={'foood-local'} />
                </Route>
                <Route path="/prod">
                    <Main host={'local-first-server.glitch.me'} prefix={'foood'} />
                </Route> */}
                <Route path="/">
                    {window.location.hostname === 'localhost' && useLocal ? (
                        <Main host={'localhost:9090'} prefix={'foood-local'} />
                    ) : (
                        <Main host={'local-first-server.glitch.me'} prefix={'foood'} />
                    )}
                </Route>
            </Switch>
        </Router>
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
