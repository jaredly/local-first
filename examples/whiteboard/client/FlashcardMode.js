// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from './Card2';
import TagsUI from './TagsUI';
import { type Collection } from '../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from './types';

const FlashcardMode = ({
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
    const idsInOrder = React.useMemo(() => {
        return Object.keys(cards).filter(id => cards[id].header == null);
    }, [cards]);
    const [index, dispatch] = React.useReducer((state, action) => {
        if (action === 'next') {
            return state >= idsInOrder.length - 1 ? 0 : state + 1;
        } else if (action === 'prev') {
            return state <= 0 ? idsInOrder.length - 1 : state - 1;
        } else {
            return state;
        }
    }, 0);

    // const currentId = React.useRef('');
    // const currentCards = React.useRef({});

    // React.useEffect(() => {
    //     const key = evt => ;
    //     window.addEventListener('keydown', key, true);
    //     // window.addEventListener('keydown', key, true)
    //     return () => {
    //         window.removeEventListener('keydown', key, true);
    //         // window.removeEventListener('keydown', key, true)
    //     };
    // }, []);

    const key = React.useRef(null);

    const mounted = React.useRef(false);

    const card = cards[idsInOrder[index]];
    if (!card) {
        console.log('nope');
        // TODO
        return <div />;
    }

    // currentId.current = card.id;
    // currentCards.current = cards;

    return (
        <div
            tabIndex="0"
            ref={node => {
                if (node && !mounted.current) {
                    mounted.current = true;
                    node.focus();
                }
            }}
            onKeyDown={evt => {
                if (evt.key === 'Tab' && evt.shiftKey) {
                    dispatch('prev');
                    evt.stopPropagation();
                    evt.preventDefault();
                    return;
                }
                if (evt.metaKey || evt.ctrlKey || evt.shiftKey) {
                    return;
                }
                evt.stopPropagation();
                evt.preventDefault();
                if (key.current) {
                    if (key.current(evt)) {
                        return;
                    }
                }
                if (
                    evt.key === 'Tab' ||
                    evt.key === 'Enter' ||
                    evt.key === ' ' ||
                    evt.key === 'ArrowRight'
                ) {
                    dispatch('next');
                }
                if (evt.key === 'ArrowLeft') {
                    dispatch('prev');
                }
            }}
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
                    right: 10,
                    border: 'none',
                    backgroundColor: 'white',
                    fontSize: 64,
                    padding: 16,
                    cursor: 'pointer',
                }}
            >
                ╳
            </button>
            <TagsUI
                selection={{ [card.id]: true }}
                cards={cards}
                cardsCol={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                setKey={fn => {
                    key.current = fn;
                }}
                clearKey={() => {
                    key.current = null;
                }}
                genId={genId}
            />
            <div style={{ fontWeight: 'bold', marginBottom: 32 }}>{card.title}</div>
            <div style={{ marginBottom: 32 }}>{card.description}</div>
            <div>
                {index + 1} / {idsInOrder.length}
            </div>
        </div>
    );
};

export default FlashcardMode;
