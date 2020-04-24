// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

import Auth from './Auth';
import App from './App';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',

        primary: { main: '#4caf50' },
        secondary: {
            main: '#76ff03',
        },
    },
});

// const host = 'localhost:9090';
// const host = 'things-to-share.glitch.me';
// window.addEventListener('load', () => {});

const Top = () => {
    return (
        <Router>
            <Switch>
                <Route path="/localhost">
                    <Main host={'localhost:9090'} dbName="planner" />
                </Route>
                <Route path="/local">
                    <Main host={null} dbName="planner-blob" />
                </Route>
                <Route path="/">
                    <Main host={'planner-server.glitch.me'} dbName="planner-glitch" />
                </Route>
            </Switch>
        </Router>
    );
};

const Main = ({ host, dbName }: { host: ?string, dbName: string }) => {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            {host != null ? (
                <Auth
                    host={host}
                    render={(auth, logout) => (
                        <App dbName={dbName} auth={auth} logout={logout} host={host} />
                    )}
                />
            ) : (
                <App dbName={dbName} auth={null} logout={() => {}} host={''} />
            )}
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
