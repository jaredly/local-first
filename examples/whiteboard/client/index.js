// @flow
// /** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { createInMemoryDeltaClient } from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import { type Schema } from '../../../packages/client-bundle';

const defaultCards = require('./data.json');

type Card = {
    id: string,
    title: string,
    description: string,
    position: { x: number, y: number },
    size: { width: number, height: number },
    color: ?string,
    header: ?number,
    disabled: boolean,
};

const CardSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        description: 'string',
        position: { type: 'object', attributes: { x: 'number', y: 'number' } },
        size: {
            type: 'object',
            attributes: { width: 'number', height: 'number' },
        },
        color: { type: 'optional', value: 'string' },
        header: { type: 'optional', value: 'number' },
        disabled: 'boolean',
    },
};

const DEFAULT_HEIGHT = 100;
const DEFAULT_WIDTH = 200;

const makeDefaultCards = genId => {
    return defaultCards.map(({ description, title }, i) => ({
        id: genId(),
        title,
        description,
        position: { x: 0, y: i * DEFAULT_HEIGHT },
        size: { height: DEFAULT_HEIGHT, width: DEFAULT_WIDTH },
        disabled: false,
    }));
};

const Whiteboard = () => {
    // we're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            createInMemoryDeltaClient(
                { cards: CardSchema },
                `ws://localhost:9090/ephemeral/sync`,
            ),
        [],
    );
    const [col, cards] = useCollection(React, client, 'cards');

    return (
        <div>
            Oy
            <button
                onClick={() => {
                    makeDefaultCards(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                }}
            >
                Add default cards
            </button>
            <div>
                {Object.keys(cards)
                    .map(id => cards[id])
                    .map(card => (
                        <div
                            key={card.id}
                            style={{
                                backgroundColor: 'white',
                                padding: 16,
                                boxShadow: '0 0 3px #ccc',
                                position: 'absolute',
                                top: card.position.y,
                                left: card.position.x,
                                width: card.size.width,
                                height: card.size.height,
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 'bold',
                                    marginBottom: 8,
                                    textAlign: 'center',
                                }}
                            >
                                {card.title}
                            </div>
                            <div>{card.description}</div>
                        </div>
                    ))}
            </div>
        </div>
    );
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
