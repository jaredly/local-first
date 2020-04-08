// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import {
    createInMemoryDeltaClient,
    createPersistedDeltaClient,
    createPersistedBlobClient,
} from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';

import { SortSchema, CommentSchema, CardSchema } from './types';

import Main from './Main';
import Auth, { useAuthStatus } from './Auth';

const schemas = {
    cards: CardSchema,
    comments: CommentSchema,
    sorts: SortSchema,
};

const AppWithAuth = ({ host }) => {
    const status = useAuthStatus(host);
    if (status === null) {
        // Waiting
        return <div />;
    } else if (status === false) {
        return <Auth host={host} />;
    } else {
        return <App host={host} auth={status} />;
    }
};

const App = ({
    host,
    auth,
}: {
    host: string,
    auth: ?{ token: string, user: { name: string, email: string } },
}) => {
    // We're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        auth
            ? () =>
                  createPersistedDeltaClient(
                      'value-sort',
                      schemas,
                      `${host.startsWith('localhost:') ? 'ws' : 'wss'}://${host}/sync?token=${
                          auth.token
                      }`,
                  )
            : () => createPersistedBlobClient('miller-values-sort', schemas, null, 2),
        [],
    );
    return <Main client={client} user={auth ? auth.user : null} />;
};

const root = document.createElement('div');
if (document.body) {
    document.body.appendChild(root);
    // const host = 'localhost:9090';
    const host = 'value-sort-server.glitch.me';
    render(<AppWithAuth host={host} />, root);
}
