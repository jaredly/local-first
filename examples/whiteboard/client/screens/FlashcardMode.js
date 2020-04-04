// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from '../Card';
import TagsUI from '../TagsUI';
import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from '../types';

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
        return Object.keys(cards).filter((id) => cards[id].header == null);
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

    const [focus, setFocus] = React.useState(null);
    const key = React.useRef(null);
    const mounted = React.useRef(false);

    const card = cards[idsInOrder[index]];
    if (!card) {
        console.log('nope');
        // TODO
        return <div />;
    }

    return (
        <div
            tabIndex="0"
            ref={(node) => {
                if (node && !mounted.current) {
                    mounted.current = true;
                    node.focus();
                }
            }}
            onKeyDown={(evt) => {
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
                if (focus && +evt.key == evt.key) {
                    const scale = focus;
                    const n = parseInt(evt.key);
                    if (!isNaN(n) && n >= scale.min && n <= scale.max) {
                        if (n !== card.scales[scale.id]) {
                            col.setAttribute(card.id, ['scales', scale.id], n);
                        }
                        dispatch('next');
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
                flexDirection: 'row',
                // justifyContent: 'center',
                // alignItems: 'center',
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
                    fontSize: 32,
                    padding: 16,
                    cursor: 'pointer',
                }}
            >
                ╳
            </button>
            <TagsUI
                selection={{ [card.id]: true }}
                setSelection={() => {}}
                cards={cards}
                cardsCol={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                onFocusScale={(scale) => setFocus(scale)}
                genId={genId}
            />
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    fontSize: 36,
                    flexDirection: 'column',
                }}
            >
                {focus !== null ? (
                    <FocusScale
                        clear={() => setFocus(null)}
                        scale={focus}
                        current={card.scales[focus.id]}
                        onClick={(v) => {
                            col.setAttribute(
                                card.id,
                                ['scales', focus.id],
                                card.scales[focus.id] === v ? null : v,
                            );
                        }}
                    />
                ) : null}
                <div
                    css={{
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        display: 'flex',
                        flex: 1,
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: 32 }}>{card.title}</div>
                    <div style={{ marginBottom: 32 }}>{card.description}</div>
                    <div>
                        {index + 1} / {idsInOrder.length}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FocusScale = ({ scale, current, onClick, clear }) => {
    const nodes = [];
    for (let i = scale.min; i <= scale.max; i++) {
        nodes.push(
            <div
                style={
                    current === i
                        ? {
                              backgroundColor: scale.color,
                          }
                        : {}
                }
                css={{
                    position: 'relative',
                    cursor: 'pointer',
                    flex: 1,
                    width: '2em',
                    textAlign: 'center',
                    border: '2px solid transparent',
                    borderRadius: 4,
                    ':hover': {
                        borderColor: '#0af',
                    },
                }}
                key={i}
                onClick={() => onClick(i)}
            >
                {i}
            </div>,
        );
    }
    return (
        <div css={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div>{scale.title}</div>
            <div
                css={{
                    display: 'flex',
                    flexDirection: 'row',
                }}
            >
                {nodes}
            </div>
            <div css={{ fontSize: 12 }}>Use keyboard for rapid rating</div>
            <button onClick={() => clear()}>Clear focused scale</button>
        </div>
    );
};

export default FlashcardMode;
