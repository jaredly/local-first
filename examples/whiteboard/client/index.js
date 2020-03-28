// @flow
// /** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { createInMemoryDeltaClient } from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import { type Schema } from '../../../packages/client-bundle';

type Card = {
    title: string,
    description: string,
    position: { x: number, y: number },
    size: { width: number, height: number },
    color: string,
    header: ?number,
    disabled: boolean,
};

const CardSchema: Schema = {
    type: 'object',
    attributes: {
        title: 'string',
        description: 'string',
        position: { type: 'object', attributes: { x: 'number', y: 'number' } },
        size: {
            type: 'object',
            attributes: { width: 'number', width: 'number' },
        },
        color: 'string',
        header: { type: 'optional', value: 'number' },
        disabled: 'boolean',
    },
};

const Whiteboard = () => {
    // we're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            createInMemoryDeltaClient(
                { cards: CardSchema },
                `http://localhost:9090/ephemeral/sync`,
            ),
        [],
    );
    const [col, cards] = useCollection(React, client, 'cards');

    return <div>Hello folks!</div>;
};

const App = () => {
    return <Whiteboard />;
};

const root = document.createElement('div');
document.body.appendChild(root);
render(<App />, root);

// const setupDelta = () => {
//     return createDeltaClient(
//         newCrdt,
//         schemas,
//         new PersistentClock(localStorageClockPersist('local-first')),
//         makeDeltaPersistence('local-first', ['tasks', 'notes']),
//         createWebSocketNetwork('ws://localhost:9900/sync'),
//     );
// };
