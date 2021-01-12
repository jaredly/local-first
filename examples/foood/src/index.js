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
import PublicRecipe from './PublicRecipe';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',

        primary: {
            main:
                // window.localStorage.useLocalFoood === 'true' && location.hostname === 'localhost'
                //     ? '#8561c5'
                //     : '#ff9800',
                '#ff9800',
        },
        secondary: {
            // main: '#ffea00',
            main: '#00e5ff',
        },
    },
});

const Main = ({ host, prefix }: { host?: ?string, prefix?: ?string }) => {
    console.log('main render?', host);
    // const match = useRouteMatch();
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
            <Router>
                <Switch>
                    {/* <Main host={null} /> TODO maybe reenable this with a localStorage key? */}
                    <Route path="/public/recipe/:id">
                        <PublicRecipe host={host} />
                    </Route>
                    <Route path="/">
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
                    </Route>
                </Switch>
            </Router>
        </ThemeProvider>
    );
};

const Top = () => {
    const useLocal = window.localStorage.useLocalFoood === 'true';
    return window.location.hostname === 'localhost' && useLocal ? (
        <Main host={'localhost:9090'} prefix={'foood-local'} />
    ) : (
        <Main host={'local-first-server.glitch.me'} prefix={'foood'} />
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
