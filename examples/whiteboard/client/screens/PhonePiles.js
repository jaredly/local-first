// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../types';
import { useSpring, animated, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import { Colors } from '../Styles';

import { EditableTitle, shuffle, CARD_HEIGHT, CARD_WIDTH } from './AnimatedPiles';

const PILE_HEIGHT = CARD_HEIGHT * 0.8;

const PhonePiles = ({
    col,
    cards,
    onDone,
    genId,
    sort,
    sortsCol,
}: {
    onDone: () => void,
    col: Collection<CardT>,
    cards: { [key: string]: CardT },
    genId: () => string,
    sort: SortT,
    sortsCol: Collection<SortT>,
}) => {
    const cardsInOrder = React.useMemo(() => {
        const keys = Object.keys(cards);
        const sorted = keys
            .filter((k) => !!sort.cards[k])
            .sort((a, b) => sort.cards[a].placementTime - sort.cards[b].placementTime);
        const unsorted = shuffle(keys.filter((k) => !sort.cards[k]));
        return sorted.concat(unsorted);
        // return sorted.concat(unsorted).map((id) => ({
        //     id,
        //     tilt: Math.random() * 2 - 1,
        // }));
    }, []);
    const pilesInOrder = Object.keys(sort.piles)
        .map((x) => +x)
        .sort();
    let top = 0;
    let firstCard = null;

    const countsPerPile = {};
    pilesInOrder.forEach((id) => (countsPerPile[id] = 0));
    Object.keys(sort.cards).forEach((id) => {
        countsPerPile[sort.cards[id].pile] += 1;
    });
    const numOfPile = { ...countsPerPile };

    const positions = cardsInOrder.map((id, i) => {
        if (sort.cards[id]) {
            const num = numOfPile[sort.cards[id].pile];
            numOfPile[sort.cards[id].pile] -= 1;
            const SEP = 20;
            const total = (window.innerWidth - CARD_WIDTH) / SEP - 5;
            const at = Math.min(total, num);
            const dy = 10 / total;
            return {
                pos: [
                    // window.innerWidth / 2 + Math.min(num, 5) * 10,
                    (at + 2) * SEP + CARD_WIDTH / 2,
                    10 +
                        window.innerHeight -
                        PILE_HEIGHT * pilesInOrder.indexOf(sort.cards[id].pile) -
                        dy * at,
                ],
                num,
                pile: sort.cards[id].pile,
            };
        } else {
            if (firstCard === null) {
                firstCard = id;
            }
            const max = 100 + 6 * 25;
            const off = Math.min(top, 5);
            const pos = off * 25;
            top = Math.min(top + 1, 6);
            return { pos: [window.innerWidth / 2 + off * 1 - 3, max - pos], at: top };
        }
    });
    const springs = positions.map(({ pos }, i) => {
        return useSpring({ pos });
    });

    return (
        <div css={styles.container}>
            <div css={{ textAlign: 'center', padding: 16, color: Colors.offBlack }}>
                <a href="/#" css={styles.backArrow}>
                    →
                </a>
                <div>{sort.title}</div>
                {/* <EditableTitle
                    title={sort.title}
                    onChange={(newTitle) => sortsCol.setAttribute(sort.id, ['title'], newTitle)}
                /> */}
            </div>
            <div>
                {positions.map((pos, i) => (
                    <animated.div
                        key={cardsInOrder[i]}
                        css={styles.card}
                        onClick={() => {
                            if (sort.cards[cardsInOrder[i]]) {
                                sortsCol.clearAttribute(sort.id, ['cards', cardsInOrder[i]]);
                            }
                        }}
                        style={{
                            outline: pos.at === 1 ? `2px solid ${Colors.darkPink}` : null,
                            transform: springs[i].pos.interpolate(
                                (x, y) => `translate(${x}px, ${y}px)`,
                            ),
                            zIndex:
                                pos.pile != null
                                    ? (pilesInOrder.length - pilesInOrder.indexOf(pos.pile)) * 2 + 1
                                    : pos.at != null
                                    ? 6 - pos.at
                                    : undefined,
                        }}
                    >
                        <div css={styles.title}>{cards[cardsInOrder[i]].title}</div>
                        <div>{cards[cardsInOrder[i]].description}</div>
                    </animated.div>
                ))}
            </div>
            <div
                css={{
                    zIndex: 10,
                    position: 'absolute',
                    top: 100 - CARD_HEIGHT / 2,
                    left: '50%',
                    marginLeft: (-CARD_WIDTH / 2) * 1.1,
                    width: CARD_WIDTH * 1.1,
                    height: CARD_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '2px 2px 4px #ccc',
                    fontWeight: 'bold',
                    color: Colors.offBlack,
                    backgroundColor: Colors.pink,
                    border: `1px solid ${Colors.darkPink}`,
                }}
            >
                Miller Card Sort
            </div>
            <div>
                {pilesInOrder.map((id, i) => (
                    <div
                        key={id}
                        css={styles.pile}
                        onClick={() => {
                            if (firstCard) {
                                sortsCol.setAttribute(sort.id, ['cards', firstCard], {
                                    pile: +id,
                                    placementTime: Date.now(),
                                });
                            }
                        }}
                        style={{
                            zIndex: (pilesInOrder.length - i) * 2,
                            bottom: i * PILE_HEIGHT,
                        }}
                    >
                        <div css={styles.pileTitle}>
                            <div
                                css={{
                                    width: '1.5em',
                                    textAlign: 'center',
                                    backgroundColor: Colors.darkPink,
                                    borderRadius: 4,
                                    marginRight: 8,
                                }}
                            >
                                {countsPerPile[id]}
                            </div>
                            {sort.piles[id].title}
                            <div style={{ flex: 1 }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const styles = {
    card: {
        transition: '.2s ease outline-color',
        overflow: 'hidden',
        textAlign: 'center',
        flexShrink: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: 'white',
        padding: 8,
        border: '1px solid #ccc',
        margin: 8,
        position: 'absolute',
        userSelect: 'none',
        top: 0,
        left: 0,
        marginTop: -CARD_HEIGHT / 2,
        marginLeft: -CARD_WIDTH / 2,
    },

    container: {
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },

    pileTitle: {
        display: 'flex',
        flexDirection: 'row',
        fontWeight: 'bold',
        marginBottom: 8,
        fontSize: '1.2em',
        textAlign: 'left',
        padding: '4px 8px',
    },

    pile: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        backgroundColor: Colors.lightPink,
        borderTop: `1px solid ${Colors.offBlack}`,
        height: PILE_HEIGHT,
    },

    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    backArrow: {
        position: 'absolute',
        top: 0,
        left: 0,
        fontSize: 32,
        transform: `scaleX(-1)`,
        textDecoration: 'none',
        padding: '4px 16px',
    },
};

export default PhonePiles;
