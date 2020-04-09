// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../../types';
import { useSpring, animated, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import { Colors } from '../../Styles';

type Card = { x: number, y: number, id: string, pile?: ?number, tilt: number };

export * from './consts';
import { CARD_WIDTH, CARD_HEIGHT } from './consts';

export { shuffle } from './Cards';
import Cards from './Cards';
import EditableTitle from './EditableTitle';
import Piles from './Piles';

const useWindowSize = () => {
    const [size, setSize] = React.useState({ w: window.innerWidth, h: window.innerHeight });
    React.useEffect(() => {
        const fn = () => {
            setSize({ w: window.innerWidth, h: window.innerHeight });
        };
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    return size;
};

const PilesMode = ({
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
    useWindowSize();

    const [currentTarget, setCurrentTarget] = React.useState(null);

    const [openPile, setOpenPile] = React.useState(null);
    const [fullyRendered, setFullyRendered] = React.useState(false);
    const deckPosition = React.useRef(null);

    const pilePositions: { [key: string]: ?{ x: number, y: number } } = React.useMemo(
        () => ({}),
        [],
    );
    // Object.keys(sort.piles).forEach((k) => {
    //     pilePositions.current[k] = null
    // });

    const pileContainerRef = React.useRef(null);
    const middleY = window.innerHeight / 2 - CARD_HEIGHT / 2;
    const baseY =
        middleY < CARD_HEIGHT * 3 ? window.innerHeight - (CARD_HEIGHT / 2) * 1.5 : middleY;

    return (
        <div style={styles.container}>
            <div
                css={{
                    textAlign: 'center',
                    color: Colors.offBlack,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <a href="/#" css={styles.backArrow}>
                    →
                </a>
                <EditableTitle
                    title={sort.title}
                    onChange={(newTitle) => sortsCol.setAttribute(sort.id, ['title'], newTitle)}
                />
                <div />
                {/* <button
                    onClick={() => {
                        sortsCol.delete(sort.id);
                        window.location.hash = '#';
                    }}
                >
                    🗑
                </button> */}
            </div>
            <Piles
                sort={sort}
                onClick={(id) => (id === openPile ? setOpenPile(null) : setOpenPile(id))}
                onRef={(id, node) => {
                    const box = node.getBoundingClientRect();
                    const pos = {
                        y: box.top + box.height / 2,
                        x: box.left + box.width / 2,
                    };
                    const prevNot = !pilePositions['' + id];
                    pilePositions['' + id] = pos;
                    if (prevNot && isFullyRendered(pilePositions, deckPosition)) {
                        setFullyRendered(true);
                    }
                }}
                hovered={currentTarget ? +currentTarget : null}
                selected={openPile}
            />
            {fullyRendered ? (
                <Cards
                    cards={cards}
                    sort={sort}
                    sortsCol={sortsCol}
                    pilePositions={pilePositions}
                    openPile={openPile}
                    setCurrentTarget={setCurrentTarget}
                    deckPosition={deckPosition}
                    baseY={baseY}
                />
            ) : null}
            <Deck
                hovered={currentTarget === 'deck'}
                deckPosition={deckPosition}
                pilePositions={pilePositions}
                setFullyRendered={setFullyRendered}
                cards={cards}
                sort={sort}
            />
            <div style={{ flex: 1 }} />
        </div>
    );
};

const Deck = ({ deckPosition, pilePositions, setFullyRendered, hovered, cards, sort }) => {
    const { sorted, unsorted } = React.useMemo(() => {
        let sorted = 0;
        let unsorted = 0;
        Object.keys(cards).forEach((k) => {
            if (sort.cards[k] != null) {
                sorted += 1;
            } else {
                unsorted += 1;
            }
        });
        return { sorted, unsorted };
    }, [cards, sort]);
    return (
        <div
            ref={(node) => {
                if (node) {
                    const box = node.getBoundingClientRect();
                    const pos = {
                        y: box.top + box.height / 2,
                        x: box.left + box.width / 2,
                    };
                    const prevNot = !deckPosition.current;
                    deckPosition.current = pos;
                    if (prevNot && isFullyRendered(pilePositions, deckPosition)) {
                        setFullyRendered(true);
                    }
                }
            }}
            css={styles.deck}
            style={{
                // top: baseY,
                outline: hovered ? `3px solid ${Colors.offBlack}` : null,
            }}
        >
            Miller Value Sort
            <div>
                {'' + unsorted} / {'' + (sorted + unsorted)}
            </div>
        </div>
    );
};

const isFullyRendered = (piles, deck) => {
    return deck.current && !Object.keys(piles).some((k) => !piles[k]);
};

const boxSize = 1.3;

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },

    deck: {
        backgroundColor: Colors.darkPink,
        color: Colors.offBlack,
        fontWeight: 'bold',
        alignSelf: 'flex-end',
        marginTop: 48,
        width: CARD_WIDTH * boxSize,
        height: CARD_HEIGHT * boxSize,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        border: '1px solid #ccc',
        borderColor: Colors.darkestPink,
        position: 'relative',
    },

    backArrow: {
        // position: 'absolute',
        // top: 0,
        // left: 0,
        fontSize: 32,
        transform: `scaleX(-1)`,
        textDecoration: 'none',
        padding: '4px 16px',
    },
};

export default PilesMode;
