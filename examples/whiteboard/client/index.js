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

import { TagSchema, ScaleSchema, CommentSchema, CardSchema } from './types';

import Main from './Main';

const schemas = {
    cards: CardSchema,
    comments: CommentSchema,
    tags: TagSchema,
    scales: ScaleSchema,
};

const App = () => {
    // We're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () => createPersistedBlobClient('miller-values-sort', schemas, null, 1),
        // createInMemoryDeltaClient(
        // schemas,
        //     `ws://localhost:9090/ephemeral/sync`,
        // ),
        [],
    );
    return <Main client={client} />;
};

const root = document.createElement('div');
if (document.body) {
    document.body.appendChild(root);
    render(<App />, root);
}
