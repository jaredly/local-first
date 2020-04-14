// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import Button from '@material-ui/core/Button';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';

import 'typeface-roboto';

import {
    createInMemoryDeltaClient,
    createPersistedDeltaClient,
    createPersistedBlobClient,
} from '../../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';
import CssBaseline from '@material-ui/core/CssBaseline';

import { TagSchema, LinkSchema } from './types';

import Auth from './Auth';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',
    },
});

const App = ({ host }: { host: string }) => {
    return (
        <Auth
            host={host}
            render={() => (
                <Button color="primary" variant="contained">
                    Ok buttons
                </Button>
            )}
        />
    );
};

const node = document.createElement('div');
document.body.appendChild(node);
const host = 'localhost:9090';
render(
    <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App host={host} />
    </ThemeProvider>,
    node,
);
