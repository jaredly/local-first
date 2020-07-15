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

const Main = ({ host, dbName }: { host: ?string, dbName: string }) => {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            {host != null ? (
                <Auth
                    host={host}
                    render={(auth, logout) => (
                        <App dbName={dbName} authData={{ host, auth, logout }} />
                    )}
                />
            ) : (
                <App dbName={dbName} authData={null} />
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
    render(<Main host="localhost:9090" dbName="tree-notes-glitch" />, node);
    // render(<Main host="local-first-server.glitch.me" dbName="tree-notes-glitch" />, node);
};

export default run;
