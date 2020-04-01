// @flow
// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../packages/client-bundle';

import { DEFAULT_MARGIN } from './defaults';
import { type CardT } from './types';

const ColumnButtons = ({
    cards,
    col,
    selection,
}: {
    cards: { [key: string]: CardT },
    col: Collection<CardT>,
    selection: { [key: string]: boolean },
}) => {
    return (
        <div
            style={styles.columnButtonContainer}
            onClick={evt => evt.stopPropagation()}
            onMouseDown={evt => evt.stopPropagation()}
        >
            <button
                style={styles.columnButtonStyle}
                onClick={() => arrangeCards(cards, selection, 1, col)}
            >
                ||
            </button>
            <button
                style={styles.columnButtonStyle}
                onClick={() => arrangeCards(cards, selection, 2, col)}
            >
                |||
            </button>
            <button
                style={styles.columnButtonStyle}
                onClick={() => arrangeCards(cards, selection, 3, col)}
            >
                ||||
            </button>
        </div>
    );
};

const arrangeCards = (
    cards: { [key: string]: CardT },
    selection,
    columns,
    collection,
) => {
    // if they're already roughly in a grid, it would be nice to maintain that...
    const selectedCards = Object.keys(selection).map(key => cards[key]);
    if (!selectedCards.length) {
        return;
    }
    selectedCards.sort((c1, c2) => {
        if ((c1.header || 0) > (c2.header || 0)) {
            return -1;
        }
        if ((c2.header || 0) > (c1.header || 0)) {
            return 1;
        }
        // if one is *definitely* higher than the other (more than 50% of the height), then it's before
        // otherwise, if one is *definiely* to the left of the other one, it's before
        // otherwise, compare dx & dy, whichever's bigger?
        if (c1.position.y + c1.size.y * 0.75 < c2.position.y) {
            return -1;
        }
        if (c2.position.y + c2.size.y * 0.75 < c1.position.y) {
            return 1;
        }
        if (c1.position.x + c1.size.x * 0.75 < c2.position.x) {
            return -1;
        }
        if (c2.position.x + c2.size.x * 0.75 < c1.position.x) {
            return 1;
        }
        const dx = c1.position.x - c2.position.x;
        const dy = c1.position.y - c2.position.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx;
        } else {
            return dy;
        }
    });
    let minX = selectedCards[0].position.x;
    let minY = selectedCards[0].position.y;
    selectedCards.forEach(card => {
        minX = Math.min(minX, card.position.x);
        minY = Math.min(minY, card.position.y);
    });
    const rows = Math.ceil(selectedCards.length / columns);
    let x = minX;
    let y = minY;
    let rowHeight = 0;
    selectedCards.forEach((card, i) => {
        if (i % columns === 0 && i !== 0) {
            x = minX;
            y += rowHeight + DEFAULT_MARGIN;
            rowHeight = 0;
        }
        rowHeight = Math.max(rowHeight, card.size.y);
        if (x !== card.position.x || y !== card.position.y) {
            collection.setAttribute(card.id, ['position'], { x, y });
        }

        x += card.size.x + DEFAULT_MARGIN;
    });
};

const styles = {
    columnButtonContainer: {
        position: 'absolute',
        zIndex: 1000,
        left: '50%',
        top: 0,
    },
    columnButtonStyle: {
        border: '1px solid #ccc',
        padding: '4px 12px',
        backgroundColor: 'white',
        fontSize: 24,
    },
};

export default ColumnButtons;
