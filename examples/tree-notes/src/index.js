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
                <Route path="/localhost">
                    <Main host={'localhost:9090'} dbName="tree-notes-glitch-2" />
                </Route>
                {/* <Route path="/local">
                    <Main host={null} dbName="planner-blob" />
                </Route> */}
                <Route path="/">
                    <Main host={'local-first-server.glitch.me'} dbName="tree-notes-glitch" />
                </Route>
            </Switch>
        </Router>
    );
};

const Main = ({ host, dbName }: { host: string, dbName: string }) => {
    console.log('main render?');
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Auth
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
    // render(<Main host="localhost:9090" dbName="tree-notes-glitch-2" />, node);
    render(<Top />, node);
    // render(<Main host="local-first-server.glitch.me" dbName="tree-notes-glitch" />, node);
};

export default run;
