// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';

import { type Collection } from '../../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../../types';
import { useSpring, animated, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import { Colors } from '../../Styles';

export const shuffle = function<T>(array: Array<T>): Array<T> {
    return array
        .map((item) => [Math.random(), item])
        .sort((a, b) => a[0] - b[0])
        .map((item) => item[1]);
};

import { CARD_HEIGHT, CARD_WIDTH } from './consts';
const openInc = CARD_HEIGHT / 2;
const MARGIN = 24;

const currentPositions = (baseY, cardPositions, sort, pilePositions, openPile) => {
    let leftPos = 0;
    let firstCard = null;
    let secondCard = null;
    let openY = 0;
    let openX = 0;
    const positions = cardPositions.map(({ x, y, tilt, id }, i) => {
        if (sort.cards[id] != null) {
            const pile = sort.cards[id].pile;
            if (pilePositions[pile].current) {
                const pilePos = pilePositions[pile].current;
                let maxY = (window.innerHeight - pilePos.y - CARD_HEIGHT) / openInc;
                if (openPile != null && pile === openPile) {
                    openY += 1;
                    if (openY > maxY) {
                        openY = 1;
                        openX += 1;
                    }
                    return {
                        x: pilePos.x + openX * CARD_WIDTH * 0.9,
                        y: pilePos.y - CARD_HEIGHT / 2 + openY * openInc,
                    };
                }
                return {
                    x: pilePos.x + (x * CARD_WIDTH) / 4,
                    y: pilePos.y + (y * CARD_HEIGHT) / 4,
                };
            }
            return { x: 0, y: 0 };
        }
        if (firstCard === null) {
            firstCard = id;
        } else if (secondCard === null) {
            secondCard = id;
        }
        const xPos = window.innerWidth / 2 - CARD_WIDTH / 2 + leftPos * (CARD_WIDTH + MARGIN);
        const pos = {
            x: Math.min(xPos, window.innerWidth - CARD_WIDTH / 2),
            y: baseY,
        };
        leftPos += 1;
        return pos;
    });
    return { positions, firstCard, secondCard };
};

const getNewPos = (i, pile, cardPositions, pilePositions, sort, baseY, openPile) => {
    const { x, y } = cardPositions[i];
    if (pile != null) {
        if (pilePositions[pile].current) {
            const pilePos = pilePositions[pile].current;
            if (openPile && pile === openPile) {
                let openY = 0;
                let openX = 0;
                let maxY = (window.innerHeight - pilePos.y - CARD_HEIGHT) / openInc;
                for (let j = 0; j < i; j++) {
                    if (
                        sort.cards[cardPositions[j].id] &&
                        sort.cards[cardPositions[j].id].pile === pile
                    ) {
                        openY += 1;
                        if (openY > maxY) {
                            openY = 1;
                            openX += 1;
                        }
                    }
                }
                openY += 1;
                if (openY > maxY) {
                    openY = 1;
                    openX += 1;
                }
                return {
                    x: pilePos.x + openX * CARD_WIDTH * 0.9,
                    y: pilePos.y - CARD_HEIGHT / 2 + openY * openInc,
                };
            }
            return {
                x: pilePos.x + (x * CARD_WIDTH) / 4,
                y: pilePos.y + (y * CARD_HEIGHT) / 4,
            };
        }
        return null;
    }
    let leftPos = 0;
    for (let j = 0; j < i; j++) {
        if (sort.cards[cardPositions[j].id] == null) {
            leftPos += 1;
        }
    }
    const xPos = window.innerWidth / 2 - CARD_WIDTH / 2 + leftPos * (CARD_WIDTH + MARGIN);
    return {
        x: Math.min(xPos, window.innerWidth - CARD_WIDTH / 2),
        y: baseY,
    };
};

const dist = (pos) => Math.sqrt(pos.x * pos.x + pos.y * pos.y);
const distTo = (p1, p2) => dist({ x: p2.x - p1.x, y: p2.y - p1.y });

const dragHandler = ({
    i,
    pilePositions,
    baseY,
    down,
    openPile,
    movement: [x, y],
    vxvy,
    cardPositions,
    currentSprings,
    sort,
    getClosestTarget,
    setCurrentTarget,
    currentDrag,
    sortsCol,
    springs,
}) => {
    const dest = currentSprings.current[i][2];
    const current = { x: x + dest.pos[0], y: y + dest.pos[1] };
    const mul = 100;
    const projected = {
        x: x + dest.pos[0] + vxvy[0] * mul,
        y: y + dest.pos[1] + vxvy[1] * mul,
    };
    const cdist = dist({ x: dest.pos[0] - projected.x, y: dest.pos[1] - projected.y });
    if (!down) {
        const closestTarget = getClosestTarget(projected, sort.cards[cardPositions[i].id]);
        setCurrentTarget(null);
        if (currentDrag.current === i) {
            currentDrag.current = null;
        }
        if (closestTarget && closestTarget.dist < cdist) {
            if (closestTarget.deck) {
                sortsCol.clearAttribute(sort.id, ['cards', cardPositions[i].id]);
            } else {
                const missing = cardPositions.some(
                    (card, idx) => idx !== i && sort.cards[card.id] == null,
                );
                if (!missing && sort.completedDate == null) {
                    sortsCol.setAttribute(sort.id, ['completedDate'], Date.now());
                }
                sortsCol.setAttribute(sort.id, ['cards', cardPositions[i].id], {
                    pile: +closestTarget.pile,
                    placementTime: Date.now(),
                });
            }
            const newPos = getNewPos(
                i,
                closestTarget.deck ? null : +closestTarget.pile,
                cardPositions,
                pilePositions,
                sort,
                baseY,
                openPile,
            );
            if (newPos) {
                springs[i][1]({
                    config: { velocity: vxvy },
                    pos: [newPos.x, newPos.y],
                    immediate: false,
                });
            }
            // TODO, we want to
        } else {
            springs[i][1]({
                config: { velocity: vxvy },
                pos: dest.pos,
                immediate: false,
            });
        }
        return;
    }
    const closestTarget = getClosestTarget(current, sort.cards[cardPositions[i].id]);
    if (closestTarget && closestTarget.dist < cdist) {
        setCurrentTarget(closestTarget.deck ? 'deck' : closestTarget.pile);
    } else {
        setCurrentTarget(null);
    }
    currentDrag.current = i;
    springs[i][1]({
        pos: [current.x, current.y],
        immediate: true,
    });
};

const Cards = ({
    cards,
    sort,
    sortsCol,
    pilePositions,
    openPile,
    setCurrentTarget,
    deckPosition,
    baseY,
}: {
    cards: { [key: string]: CardT },
    sort: SortT,
    sortsCol: Collection<SortT>,
    pilePositions: { [key: number]: { current: ?{ x: number, y: number } } },
    openPile: ?number,
    setCurrentTarget: (?(number | 'deck')) => void,
    deckPosition: { current: ?{ x: number, y: number } },
    baseY: number,
}): React.Node => {
    const cardPositions = React.useMemo(() => {
        const keys = Object.keys(cards);
        const sorted = keys
            .filter((k) => !!sort.cards[k])
            .sort((a, b) => sort.cards[a].placementTime - sort.cards[b].placementTime);
        const unsorted = shuffle(keys.filter((k) => !sort.cards[k]));

        return sorted.concat(unsorted).map((id) => ({
            id,
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            tilt: Math.random() * 2 - 1,
        }));
    }, []);

    const { positions, firstCard, secondCard } = currentPositions(
        baseY,
        cardPositions,
        sort,
        pilePositions,
        openPile,
    );

    const currentDrag = React.useRef(null);

    const getClosestTarget = (pos, pile) => {
        let closest = null;
        if (pile && deckPosition.current) {
            closest = {
                pos: deckPosition.current,
                dist: Math.abs(pos.y - deckPosition.current.y),
                deck: true,
            };
        }
        Object.keys(pilePositions).forEach((pid) => {
            if (pile && pile.pile === +pid) {
                return;
            }
            const ppos = pilePositions[+pid].current;
            if (!ppos) return;
            const d = distTo(pos, ppos);
            if (!closest || d < closest.dist) {
                closest = { dist: d, pile: pid, pos: ppos };
            }
        });
        return closest;
    };

    const springs = cardPositions.map((card, i) => {
        const dest = {
            pos: [positions[i].x, positions[i].y],
            immediate: false,
        };
        const [props, set] = useSpring(() => dest);
        if (currentDrag.current !== i) {
            set(dest);
        }
        return [props, set, dest];
    });

    const tiltSprings = cardPositions.map((card, i) => {
        const dest = {
            tilt: sort.cards[card.id] != null ? card.tilt : 0,
            opacity: sort.cards[card.id] != null ? 0.8 : 1,
        };
        return useSpring(dest);
    });

    const currentSprings = React.useRef(springs);
    currentSprings.current = springs;

    const bind = useDrag(({ args: [i], down, movement: [x, y], event, vxvy }) => {
        event.stopPropagation();
        dragHandler({
            i,
            down,
            baseY,
            openPile,
            pilePositions,
            movement: [x, y],
            vxvy,
            cardPositions,
            currentSprings,
            sort,
            getClosestTarget,
            setCurrentTarget,
            currentDrag,
            sortsCol,
            springs,
        });
    });

    // React.useEffect(() => {
    //     if (firstRef.current && !currentDrag.current) {
    //         const div = firstRef.current;
    //         div.focus();
    //     }
    // }, [firstRef.current, sort]);
    const cardRefs = {};
    cardPositions.forEach((item) => (cardRefs[item.id] = React.useRef(null)));

    return (
        <div>
            {cardPositions.map((item, i) => (
                <animated.div
                    key={item.id}
                    // ref={item.id === firstCard ? (node) => (firstRef.current = node) : null}
                    ref={(node) => {
                        if (node) {
                            if (cardRefs[item.id].current && cardRefs[item.id].current !== node) {
                                console.log('replace', item.id, node, cardRefs[item.id]);
                            }
                            cardRefs[item.id].current = node;
                        }
                        // console.log(item.id, node);
                    }}
                    tabIndex={'0'}
                    css={styles.card}
                    {...bind(i)}
                    style={{
                        zIndex:
                            sort.cards[item.id] && sort.cards[item.id].pile === openPile
                                ? 10
                                : undefined,
                        transform: interpolate(
                            [springs[i][0].pos, tiltSprings[i].tilt],
                            (pos, tilt) =>
                                `translate(${pos[0]}px, ${pos[1]}px) rotate(${parseInt(
                                    tilt * 15,
                                )}deg)`,
                        ),
                    }}
                    onKeyDown={(evt) => {
                        if (+evt.key == evt.key && sort.piles[+evt.key - 1]) {
                            const missing = cardPositions.some(
                                (card, idx) => idx !== i && sort.cards[card.id] == null,
                            );
                            if (!missing && sort.completedDate == null) {
                                sortsCol.setAttribute(sort.id, ['completedDate'], Date.now());
                            }

                            sortsCol.setAttribute(sort.id, ['cards', item.id], {
                                pile: +evt.key - 1,
                                placementTime: Date.now(),
                            });
                            if (secondCard && cardRefs[secondCard].current) {
                                cardRefs[secondCard].current.focus();
                            }
                        }
                    }}
                >
                    <div css={styles.title}>{cards[item.id].title}</div>
                    <div>{cards[item.id].description}</div>
                </animated.div>
            ))}
        </div>
    );
};

export default Cards;

const styles = {
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },

    card: {
        cursor: 'pointer',
        transition: '.2s ease outline-color',
        outlineColor: 'transparent',
        ':hover': {
            outline: `2px solid ${Colors.darkPink}`,
        },
        ':focus': {
            outline: `2px solid ${Colors.focusBlue}`,
        },
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
};
