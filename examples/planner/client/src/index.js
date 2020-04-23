// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';

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

const run = (host: ?string, dbName: string) => {
    const node = document.createElement('div');
    if (!document.body) {
        return;
    }
    document.body.appendChild(node);
    render(
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
        </ThemeProvider>,
        node,
    );
};

export default run;
