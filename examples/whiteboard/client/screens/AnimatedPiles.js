// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from '../Card';
import TagsUI from '../TagsUI';
import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from '../types';
import { useSprings, animated } from 'react-spring';

type State = {
    firstRef: { current: ?HTMLDivElement },
    piles: Array<{ title: string }>,
    cards: Array<Card>,
};

type Card = { x: number, y: number, id: string, pile?: ?number, tilt: number };

const initialState = (ids): State => ({
    firstRef: { current: null },
    piles: [
        { title: 'Most important' },
        { title: 'Very important' },
        { title: 'Important' },
        { title: 'Less important' },
        { title: 'Not important' },
    ],
    cards: ids.map((id) => ({
        id,
        x: Math.random() - 0.5,
        y: Math.random() - 0.5,
        tilt: Math.random() - 0.5,
    })),
});

const reduce = (state, action) => {
    // if (action === 'punt') {
    //     const waiting = state.waiting.slice();
    //     waiting.push(waiting.shift());
    //     return {
    //         ...state,
    //         waiting,
    //     };
    // } else {
    const cards = state.cards.slice();
    cards[action.card] = {
        ...cards[action.card],
        pile: action.pile,
    };
    // const piles = state.piles.slice();
    // piles[action.pile] = {
    //     ...piles[action.pile],
    //     cards: piles[action.pile].cards.concat([state.waiting[0]]),
    // };
    return {
        ...state,
        cards,
    };
    // }
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

    const pilePositions = state.piles.map(() => React.useRef(null));

    let x = 0;
    const MARGIN = 24;
    let firstCard = null;
    const positions = state.cards.map((card, i) => {
        if (card.pile != null) {
            if (pilePositions[card.pile].current) {
                const { x, y } = pilePositions[card.pile].current;
                return { x: x + (card.x * CARD_WIDTH) / 2, y: y + (card.y * CARD_HEIGHT) / 2 };
            }
            return { x: 0, y: 0 };
        }
        if (firstCard === null) {
            firstCard = i;
        }
        const pos = {
            x: window.innerWidth / 2 - CARD_WIDTH / 2 + x * (CARD_WIDTH + MARGIN),
            y: window.innerHeight / 2 - CARD_HEIGHT / 2,
        };
        x += 1;
        return pos;
    });

    // const [props, set] = useSprings(state.cards.length, (i) => ({
    //     from: {
    //         x: window.innerWidth / 2 + i * CARD_WIDTH,
    //         y: window.innerHeight / 2 - CARD_WIDTH / 2,
    //     },
    // }));

    const pileContainerRef = React.useRef(null);

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
                        ref={(node) => {
                            if (node) {
                                const box = node.getBoundingClientRect();
                                const pos = {
                                    y: box.top + box.height / 2,
                                    x: box.left + box.width / 2,
                                };
                                pilePositions[i].current = pos;
                            }
                        }}
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
                        />
                    </div>
                ))}
            </div>
            {state.cards.map((item, i) => (
                <div
                    key={item.id}
                    ref={i === firstCard ? (node) => (state.firstRef.current = node) : null}
                    tabIndex={i === firstCard ? '0' : null}
                    css={styles.card}
                    style={{
                        position: 'absolute',
                        top: positions[i].y,
                        left: positions[i].x,
                        marginTop: -CARD_HEIGHT / 2,
                        marginLeft: -CARD_WIDTH / 2,
                        transform:
                            item.pile != null ? `rotate(${parseInt(item.tilt * 30)}deg)` : null,
                    }}
                    onKeyDown={(evt) => {
                        if (
                            +evt.key == evt.key &&
                            +evt.key <= state.piles.length &&
                            +evt.key >= 1
                        ) {
                            dispatch({ type: 'key', pile: +evt.key - 1, card: i });
                        }
                    }}
                >
                    <div css={styles.title}>{cards[item.id].title}</div>
                    <div>{cards[item.id].description}</div>
                </div>
            ))}
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
