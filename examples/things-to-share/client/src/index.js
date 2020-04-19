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

        primary: { main: '#9c27b0' },
        secondary: {
            main: '#00b0ff',
        },
    },
});

const node = document.createElement('div');
if (document.body) {
    document.body.appendChild(node);
}
const host = 'localhost:9090';
// const host = 'things-to-share.glitch.me';
window.addEventListener('load', () => {
    render(
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Auth
                host={host}
                render={(auth, logout) => (
                    <App auth={auth} logout={logout} host={host} />
                )}
            />
        </ThemeProvider>,
        node,
    );
});
