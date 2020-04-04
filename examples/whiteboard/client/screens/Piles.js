// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from '../Card';
import TagsUI from '../TagsUI';
import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from '../types';

type State = {
    firstRef: { current: ?Node },
    piles: Array<{ cards: Array<{ x: number, y: number, id: string }>, title: string }>,
    waiting: Array<string>,
};

const initialState = (ids) => ({
    firstRef: { current: null },
    piles: [
        { cards: [], title: 'Most important' },
        { cards: [], title: 'Very important' },
        { cards: [], title: 'Important' },
        { cards: [], title: 'Less important' },
        { cards: [], title: 'Not important' },
    ],
    waiting: ids,
});

const reduce = (state, action) => {
    if (action === 'punt') {
        const waiting = state.waiting.slice();
        waiting.push(waiting.shift());
        return {
            ...state,
            waiting,
        };
    } else {
        const piles = state.piles.slice();
        piles[action.pile] = {
            ...piles[action.pile],
            cards: piles[action.pile].cards.concat([
                {
                    x: Math.random() - 0.5,
                    y: Math.random() - 0.5,
                    tilt: Math.random() - 0.5,
                    id: state.waiting[0],
                },
            ]),
        };
        return {
            ...state,
            piles,
            waiting: state.waiting.slice(1),
        };
    }
    return state;
};

const CARD_WIDTH = 200;
const CARD_HEIGHT = 100;

const PilesMode = ({
    col,
    cards,
    onDone,
    tags,
    scales,
    tagsCol,
    scalesCol,
    genId,
}: {
    onDone: () => void,
    col: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    genId: () => string,
}) => {
    // focus management folks.

    // baisc plan:
    // have "piles" to put the cards in
    // look into animation solutions probably.
    // maybe react-motion?
    // ok I guess react-spring is where it's at these days

    // So we've got a list of cards that are yet to be sorted into piles
    // and a set of piles.

    const initial = React.useMemo(
        () => initialState(Object.keys(cards).filter((id) => cards[id].header == null)),
        [],
    );
    const [state, dispatch] = React.useReducer(reduce, initial);

    React.useEffect(() => {
        if (state.firstRef.current) {
            state.firstRef.current.focus();
        }
    }, [state]);

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                {state.piles.map((pile, i) => (
                    <div
                        key={i}
                        style={{
                            padding: 8,
                            textAlign: 'center',
                        }}
                    >
                        <div style={styles.title}>{pile.title}</div>
                        <div
                            style={{
                                border: '1px solid #aaa',
                                width: CARD_WIDTH * 1.5,
                                height: CARD_HEIGHT * 2,
                                position: 'relative',
                            }}
                        >
                            {pile.cards.map((item) => (
                                <div
                                    css={styles.card}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0.8,
                                        top: '50%',
                                        left: '50%',
                                        marginTop: -CARD_HEIGHT / 2 + (item.x * CARD_HEIGHT) / 2,
                                        marginLeft: -CARD_WIDTH / 2 + (item.y * CARD_WIDTH) / 2,
                                        transform: `rotate(${parseInt(item.tilt * 30)}deg)`,
                                    }}
                                >
                                    <div css={styles.title}>{cards[item.id].title}</div>
                                    <div>{cards[item.id].description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div
                style={{
                    display: 'flex',
                    marginTop: '15%',
                }}
            >
                <div style={{ flex: 1 }} />

                <div
                    style={{
                        display: 'flex',
                        overflowX: 'auto',
                        flex: 1,
                    }}
                >
                    {state.waiting.map((id, i) => (
                        <div
                            key={id}
                            ref={i === 0 ? (node) => (state.firstRef.current = node) : null}
                            tabIndex="0"
                            css={styles.card}
                            onKeyDown={(evt) => {
                                if (
                                    +evt.key == evt.key &&
                                    +evt.key <= state.piles.length &&
                                    +evt.key >= 1
                                ) {
                                    dispatch({ type: 'key', pile: +evt.key - 1 });
                                } else if (evt.key === 'ArrowRight') {
                                    dispatch('punt');
                                    evt.preventDefault();
                                    evt.stopPropagation();
                                }
                            }}
                        >
                            <div css={styles.title}>{cards[id].title}</div>
                            <div>{cards[id].description}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const styles = {
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    card: {
        overflow: 'hidden',
        textAlign: 'center',
        flexShrink: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: 'white',
        padding: 8,
        boxShadow: '0 0 3px #555',
        margin: 8,
    },
};

export default PilesMode;
