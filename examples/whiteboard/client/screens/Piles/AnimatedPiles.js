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

    const pilePositions = {};
    Object.keys(sort.piles).forEach((k) => {
        pilePositions[k] = React.useRef(null);
    });

    const pileContainerRef = React.useRef(null);
    const middleY = window.innerHeight / 2 - CARD_HEIGHT / 2;
    const baseY =
        middleY < CARD_HEIGHT * 3 ? window.innerHeight - (CARD_HEIGHT / 2) * 1.5 : middleY;

    return (
        <div style={styles.container}>
            <div css={{ textAlign: 'center', padding: 16, color: Colors.offBlack }}>
                <a href="/#" css={styles.backArrow}>
                    →
                </a>
                <EditableTitle
                    title={sort.title}
                    onChange={(newTitle) => sortsCol.setAttribute(sort.id, ['title'], newTitle)}
                />
                {/* <button
                    onClick={() => {
                        sortsCol.setAttribute(sort.id, ['cards'], {});
                    }}
                >
                    Reset the sort
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
                    const prevNot = !pilePositions[id].current;
                    pilePositions[id].current = pos;
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
            {/* <div style={{ flex: 1 }} /> */}
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
                    outline: currentTarget === 'deck' ? `3px solid ${Colors.offBlack}` : null,
                }}
            >
                Miller Value Sort
            </div>
            <div style={{ flex: 1 }} />
        </div>
    );
};

export const EditableTitle = ({
    title,
    onChange,
}: {
    title: string,
    onChange: (string) => mixed,
}) => {
    const [wip, setWip] = React.useState(null);
    if (wip != null) {
        return (
            <div>
                <input
                    value={wip}
                    onChange={(evt) => setWip(evt.target.value)}
                    onKeyDown={(evt) => {
                        if (evt.key === 'Enter' && wip.trim() != '') {
                            onChange(wip);
                            setWip(null);
                        }
                    }}
                    onBlur={() => setWip(null)}
                    css={styles.titleInput}
                    autoFocus
                />
            </div>
        );
    }
    return (
        <div
            onDoubleClick={(evt) => {
                setWip(title);
            }}
            css={{ fontSize: 32 }}
        >
            {title}
        </div>
    );
};

const isFullyRendered = (piles, deck) => {
    return deck.current && !Object.keys(piles).some((k) => !piles[k].current);
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

    titleInput: {
        fontSize: 32,
        padding: 0,
        fontWeight: 'inherit',
        border: 'none',
        textAlign: 'center',
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
        position: 'absolute',
        top: 0,
        left: 0,
        fontSize: 32,
        transform: `scaleX(-1)`,
        textDecoration: 'none',
        padding: '4px 16px',
    },
};

export default PilesMode;
