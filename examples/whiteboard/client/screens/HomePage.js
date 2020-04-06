// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../types';

import { makeDefaultCards } from '../defaults';

const Sorts = ({
    sorts,
    sortsCol,
    openSort,
    genId,
}: {
    sorts: { [key: string]: SortT },
    sortsCol: Collection<SortT>,
    openSort: (SortT) => void,
    genId: () => string,
}) => {
    const [title, setTitle] = React.useState(null);
    return (
        <div
            css={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                css={{
                    maxWidth: '100%',
                    width: 800,
                    maxHeight: '100%',
                    height: 800,
                    backgroundColor: 'aliceblue',
                    borderRadius: 24,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 1,
                }}
            >
                <h1>My Sorts</h1>
                <div css={{ overflow: 'auto', flex: 1 }}>
                    {title === null ? (
                        <button
                            css={{
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                setTitle('');
                            }}
                        >
                            Create new Sort
                        </button>
                    ) : (
                        <div>
                            <input
                                value={title}
                                onChange={(evt) => setTitle(evt.target.value)}
                                placeholder="Title"
                            />
                            <button
                                onClick={() => {
                                    const id = genId();
                                    const piles = {
                                        '0': { title: 'Most important', color: colors[0] },
                                        '1': { title: 'Very important', color: colors[1] },
                                        '2': { title: 'Important', color: colors[2] },
                                        '3': { title: 'Less important', color: colors[3] },
                                        '4': { title: 'Not important', color: colors[4] },
                                    };
                                    sortsCol.save(id, {
                                        id,
                                        title,
                                        cards: {},
                                        createdDate: Date.now(),
                                        completedDate: null,
                                        // $FlowFixMe
                                        piles,
                                    });
                                }}
                            >
                                Create
                            </button>
                        </div>
                    )}
                    {Object.keys(sorts)
                        .sort((a, b) => sorts[b].createdDate - sorts[a].createdDate)
                        .map((key) => (
                            <div
                                css={{
                                    cursor: 'pointer',
                                    fontSize: 32,
                                    ':hover': {
                                        backgroundColor: '#ccc',
                                    },
                                }}
                                key={key}
                                onClick={() => openSort(sorts[key])}
                            >
                                <div>{sorts[key].title}</div>
                                <div>{new Date(sorts[key].createdDate).toLocaleString()}</div>
                                <div>
                                    {sorts[key].completedDate != null
                                        ? new Date(sorts[key].completedDate).toLocaleString()
                                        : 'Incomplete'}
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

const HomePage = ({
    cards,
    cardsCol,
    sorts,
    sortsCol,
    openSort,
    genId,
}: {
    cards: { [key: string]: CardT },
    cardsCol: Collection<CardT>,
    sorts: { [key: string]: SortT },
    sortsCol: Collection<SortT>,
    openSort: (SortT) => void,
    genId: () => string,
}) => {
    if (!Object.keys(cards).length) {
        return (
            <Welcome
                onStart={() => {
                    makeDefaultCards(genId).forEach((card) => cardsCol.save(card.id, card));
                }}
            />
        );
    }
    return <Sorts sorts={sorts} sortsCol={sortsCol} openSort={openSort} genId={genId} />;
};

const Welcome = ({ onStart }: { onStart: () => void }) => {
    return (
        <div
            css={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <h1>Welcome to the Miller Card Sort!</h1>
            <h4>Instructions</h4>
            <ul>
                <li>Drag cards around</li>
                <li>Hover a card &amp; press a number or letter key to "tag" the card</li>
                <li>Click a tag to select all cards with that tag</li>
                <li>
                    use shift+1, shift+2, and shift+3 to organize selected cards into 1, 2 or 3
                    columns
                </li>
            </ul>
            <button
                css={{
                    marginTop: 32,
                    fontSize: '2em',
                    border: 'none',
                    backgroundColor: '#0af',
                    padding: '8px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                }}
                onClick={onStart}
            >
                Click here to get started
            </button>
        </div>
    );
};
export default HomePage;
