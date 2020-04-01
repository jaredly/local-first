// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import {
    createInMemoryDeltaClient,
    createPersistedBlobClient,
} from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';

import { reducer, initialState, type State, type Action } from './state';

import MiniMap from './MiniMap';

import { TagSchema, ScaleSchema, CommentSchema, CardSchema } from './types';

import Whiteboard from './Whiteboard';

const App = () => {
    // We're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            // createPersistedBlobClient(
            //     'miller-values-sort',
            //     { cards: CardSchema, settings: SettingsSchema },
            //     null,
            //     1,
            // ),
            createInMemoryDeltaClient(
                {
                    cards: CardSchema,
                    comments: CommentSchema,
                    tags: TagSchema,
                    scales: ScaleSchema,
                },
                `ws://localhost:9090/ephemeral/sync`,
            ),
        [],
    );
    return <Whiteboard client={client} />;
};

const root = document.createElement('div');
if (document.body) {
    document.body.appendChild(root);
    render(<App />, root);
}
