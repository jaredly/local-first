// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import Button from '@material-ui/core/Button';

import {
    createInMemoryDeltaClient,
    createPersistedDeltaClient,
    createPersistedBlobClient
} from '../../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';

import { TagSchema, LinkSchema } from './types';

import Auth from './Auth';

const App = () => {
    return (
        <Auth
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
render(<App />, node);
