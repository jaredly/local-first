// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle, tagName } from './Card';
import Key from './Key';

const FlashcardMode = ({ col, cards, onDone, settings, settingsCol }) => {
    const idsInOrder = React.useMemo(() => {
        return Object.keys(cards).filter(id => cards[id].header === null);
    }, []);
    const [index, dispatch] = React.useReducer((state, action) => {
        if (action === 'next') {
            return state >= idsInOrder.length - 1 ? 0 : state + 1;
        } else if (action === 'prev') {
            return state <= 0 ? idsInOrder.length - 1 : state - 1;
        } else {
            return state;
        }
    }, 0);

    const card = cards[idsInOrder[index]];
    const currentId = React.useRef(card.id);
    currentId.current = card.id;
    const currentCards = React.useRef(cards);
    currentCards.current = cards;

    if (!card) {
        // TODO
        return <div />;
    }

    React.useEffect(() => {
        const key = evt => {
            if (evt.target !== document.body) {
                return;
            }
            if (evt.metaKey || evt.ctrlKey || evt.shiftKey) {
                return;
            }
            evt.stopPropagation();
            evt.preventDefault();
            const card = currentCards.current[currentId.current];
            const digits = '0123456789';
            if (digits.includes(evt.key)) {
                const number = +evt.key;
                if (card.number === number) {
                    col.setAttribute(card.id, ['number'], null);
                } else if (card.number !== number) {
                    col.setAttribute(card.id, ['number'], number);
                }
            }
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            if (letters.includes(evt.key)) {
                const letter = evt.key;
                if (card.letter === letter) {
                    col.setAttribute(card.id, ['letter'], null);
                } else if (card.letter !== letter) {
                    col.setAttribute(card.id, ['letter'], letter);
                }
            }
            if (
                evt.key === 'Enter' ||
                evt.key === ' ' ||
                evt.key === 'ArrowRight'
            ) {
                dispatch('next');
            }
            if (evt.key === 'ArrowLeft') {
                dispatch('prev');
            }
        };
        window.addEventListener('keydown', key, true);
        // window.addEventListener('keydown', key, true)
        return () => {
            window.removeEventListener('keydown', key, true);
            // window.removeEventListener('keydown', key, true)
        };
    }, []);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 36,
                backgroundColor: 'white',
            }}
        >
            <button
                onClick={() => onDone()}
                style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                }}
            >
                Close
            </button>
            <div
                style={{
                    position: 'absolute',
                    left: 10,
                    top: 50,
                    fontSize: 24,
                }}
            >
                <Key
                    cards={cards}
                    settings={settings}
                    settingsCol={settingsCol}
                    selectByTag={() => {}}
                />
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: 32 }}>
                {card.title}
            </div>
            <div style={{ marginBottom: 32 }}>{card.description}</div>
            <div style={{ marginBottom: 64, height: '1.5em' }}>
                {card.number != null ? (
                    <span
                        css={[tagStyle, { marginRight: 12 }]}
                        style={createTagStyle(card.number + '')}
                    >
                        {card.number}
                    </span>
                ) : null}
                {card.letter != null ? (
                    <span css={tagStyle} style={createTagStyle(card.letter)}>
                        {card.letter.toUpperCase()}
                    </span>
                ) : null}
            </div>
            <div>
                {index + 1} / {idsInOrder.length}
            </div>
        </div>
    );
};

export default FlashcardMode;
