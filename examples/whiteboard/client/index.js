// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import {
    createInMemoryDeltaClient,
    createPersistedBlobClient,
} from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import { type Schema, type Collection } from '../../../packages/client-bundle';

import FlashcardMode from './FlashcardMode';
import Key from './Key';
import Welcome from './Welcome';
import AddCard from './AddCard';
import ColumnButtons from './Columns';

import { reducer, initialState } from './state';

import {
    type pos,
    type rect,
    type TagT,
    TagSchema,
    type ScaleT,
    ScaleSchema,
    type CommentT,
    CommentSchema,
    type CardT,
    CardSchema,
    evtPos,
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    clamp,
    rectIntersect,
    toScreen,
    fromScreen,
    BOUNDS,
} from './types';

import Card from './Card';
import {
    makeDefaultCards,
    makeDefaultHeadings,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    DEFAULT_MARGIN,
} from './defaults';

import { onMove, onMouseUp } from './dragUtils';

const Whiteboard = () => {
    // we're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            // createPersistedBlobClient(
            //     'miller-values-sort',
            //     { cards: CardSchema, settings: SettingsSchema },
            //     null,
            //     1,
            // ),
            createInMemoryDeltaClient(
                {
                    cards: CardSchema,
                    comments: CommentSchema,
                    tags: TagSchema,
                    scales: ScaleSchema,
                },
                `ws://localhost:9090/ephemeral/sync`,
            ),
        [],
    );
    const [col, cards] = useCollection(React, client, 'cards');
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const [commentsCol, comments] = useCollection(React, client, 'comments');
    const [scalesCol, scales] = useCollection(React, client, 'scales');

    const [state, dispatch] = React.useReducer(reducer, initialState);
    const currentState = React.useRef(state);
    currentState.current = state;
    const currentCards = React.useRef(cards);
    currentCards.current = cards;
    const dragRef = React.useRef(false);
    const panZoom = React.useRef({ pan: state.pan, zoom: state.zoom });
    panZoom.current = { pan: state.pan, zoom: state.zoom };

    const currentHover = React.useRef(null);

    React.useEffect(() => {
        if (currentState.current.drag) {
            const timer = setInterval(() => {
                const drag = currentState.current.drag;
                if (drag) {
                    let dx = 0;
                    let dy = 0;
                    const margin = 50;
                    if (drag.screenPos.x <= margin) {
                        dx = drag.screenPos.x - margin;
                    }
                    if (drag.screenPos.y <= margin) {
                        dy = drag.screenPos.y - margin;
                    }
                    if (drag.screenPos.x >= window.innerWidth - margin) {
                        dx = drag.screenPos.x - (window.innerWidth - margin);
                    }
                    if (drag.screenPos.y >= window.innerHeight - margin) {
                        dy = drag.screenPos.y - (window.innerHeight - margin);
                    }
                    if (dx !== 0 || dy !== 0) {
                        // TODO maybe square the deltas
                        dispatch({
                            type: 'drag_scroll',
                            delta: {
                                x: dx / 2,
                                y: dy / 2,
                            },
                            drag,
                        });
                    }
                }
            }, 20);
            return () => {
                clearInterval(timer);
            };
        }
    }, [!!state.drag]);

    React.useEffect(() => {
        const key = evt => {
            if (evt.target !== document.body) {
                console.log(evt.target);
                return;
            }
            if (evt.key === 'z' && (evt.metaKey || evt.ctrlKey)) {
                client.undo();
            }

            // The Tags!
            if (evt.metaKey || evt.shiftKey) {
                return;
            }
            const keys =
                currentHover.current &&
                !currentState.current.selection[currentHover.current]
                    ? [currentHover.current]
                    : Object.keys(currentState.current.selection);
            if (!keys.length) return;

            const digits = '0123456789';
            if (digits.includes(evt.key)) {
                const number = +evt.key;
                const cards = keys.map(key => currentCards.current[key]);
                let remove = !cards.some(card => card.number !== number);
                cards.forEach(card => {
                    if (remove) {
                        col.setAttribute(card.id, ['number'], null);
                    } else if (card.number !== number) {
                        col.setAttribute(card.id, ['number'], number);
                    }
                });
            }
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            if (letters.includes(evt.key)) {
                const letter = evt.key;
                const cards = keys.map(key => currentCards.current[key]);
                let remove = !cards.some(card => card.letter !== letter);
                cards.forEach(card => {
                    if (remove) {
                        col.setAttribute(card.id, ['letter'], null);
                    } else if (card.letter !== letter) {
                        col.setAttribute(card.id, ['letter'], letter);
                    }
                });
            }
        };
        const move = evt =>
            onMove(evt, currentState.current, dispatch, dragRef);
        const up = evt => {
            onMouseUp(
                evt,
                currentState.current,
                currentCards.current,
                dispatch,
                col,
            );
        };
        const down = evt => {
            if (document.activeElement !== document.body) {
                return;
            }
            evt.preventDefault();
            // const pos = evtPos(evt);
            const pos = fromScreen(
                evtPos(evt),
                currentState.current.pan,
                currentState.current.zoom,
            );
            dispatch({ type: 'start_select', pos });
            dragRef.current = false;
        };
        const click = evt => {
            if (!dragRef.current && !evt.metaKey && !evt.shiftKey) {
                dispatch({ type: 'replace_selection', selection: {} });
            }
        };
        const mousewheel = evt => {
            dispatch({
                type: 'scroll',
                delta: {
                    x: evt.deltaX / state.zoom,
                    y: evt.deltaY / state.zoom,
                },
            });
        };
        window.addEventListener('click', click);
        window.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move, true);
        window.addEventListener('mouseup', up, true);
        window.addEventListener('keydown', key);
        window.addEventListener('mousewheel', mousewheel);
        return () => {
            window.removeEventListener('click', click);
            window.removeEventListener('mousewheel', mousewheel);
            window.addEventListener('mousedown', down);
            window.removeEventListener('mousemove', move, true);
            window.removeEventListener('mouseup', up, true);
            window.removeEventListener('keydown', key);
        };
    }, []);

    const zoomLevels = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0];

    const dragOffset =
        state.drag && state.drag.enough
            ? posDiff(state.drag.offset, state.drag.mouse)
            : null;
    const dragSelect = state.dragSelect
        ? normalizedRect(state.dragSelect)
        : null;

    const selectAllWith = React.useCallback(selector => {
        const matching = {};
        Object.keys(currentCards.current).forEach(k => {
            if (selector(currentCards.current[k])) {
                matching[k] = true;
            }
        });
        dispatch({ type: 'replace_selection', selection: matching });
    }, []);

    const [flashcard, setFlashcard] = React.useState(false);

    if (!Object.keys(cards).length) {
        return (
            <Welcome
                onStart={() => {
                    makeDefaultHeadings(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                    makeDefaultCards(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                }}
            />
        );
    }

    return (
        <div>
            {!flashcard ? (
                <div
                    style={{
                        position: 'absolute',
                        zIndex: 10000,
                        boxShadow: '0 0 2px #666',
                        backgroundColor: 'white',
                        padding: 4,
                        bottom: 10,
                        left: 10,
                    }}
                    onClick={evt => evt.stopPropagation()}
                    onMouseDown={evt => evt.stopPropagation()}
                >
                    <input
                        type="range"
                        min="0"
                        max={zoomLevels.length - 1}
                        value={zoomLevels.indexOf(state.zoom)}
                        onMouseDown={evt => evt.stopPropagation()}
                        onClick={evt => evt.stopPropagation()}
                        onChange={evt => {
                            dispatch({
                                type: 'zoom',
                                zoom: zoomLevels[evt.target.value],
                            });
                        }}
                        onMouseUp={evt => {
                            evt.target.blur();
                        }}
                    />
                    <button onClick={() => setFlashcard(true)}>
                        Flashcard Mode
                    </button>
                    <AddCard
                        onAdd={(title, description, header) => {
                            const id = client.getStamp();
                            const card = {
                                id,
                                title,
                                description,
                                header,
                                position: {
                                    x: state.pan.x + DEFAULT_MARGIN * 4,
                                    y: state.pan.y + DEFAULT_MARGIN * 4,
                                },
                                size: {
                                    y: DEFAULT_HEIGHT,
                                    x: DEFAULT_WIDTH * (header != null ? 2 : 1),
                                },
                                disabled: false,
                            };
                            col.save(id, card);
                        }}
                    />
                </div>
            ) : null}
            {Object.keys(state.selection).length > 1 ? (
                <ColumnButtons
                    cards={cards}
                    col={col}
                    selection={state.selection}
                />
            ) : null}
            <div
                style={{
                    position: 'absolute',
                    top: -state.pan.y * state.zoom,
                    left: -state.pan.x * state.zoom,
                    transform: `scale(${state.zoom.toFixed(2)})`,
                    // transform: `scale(${state.zoom.toFixed(
                    //     2,
                    // )}) translate(${(-state.pan.x).toFixed(2)}px, ${(
                    //     20 - state.pan.y
                    // ).toFixed(2)}px)`,
                }}
            >
                {Object.keys(cards)
                    .map(id => cards[id])
                    .map(card => (
                        <Card
                            currentHover={currentHover}
                            selectAllWith={selectAllWith}
                            key={card.id}
                            dragRef={dragRef}
                            panZoom={panZoom}
                            tags={tags}
                            scales={scales}
                            offset={
                                dragOffset && state.selection[card.id]
                                    ? dragOffset
                                    : null
                            }
                            selected={state.selection[card.id]}
                            hovered={
                                dragSelect && rectIntersect(dragSelect, card)
                            }
                            dispatch={dispatch}
                            card={card}
                            col={col}
                        />
                    ))}
                {dragSelect ? (
                    <div
                        style={{
                            position: 'absolute',
                            top: dragSelect.position.y,
                            left: dragSelect.position.x,
                            width: dragSelect.size.x,
                            height: dragSelect.size.y,
                            mouseEvents: 'none',
                            backgroundColor: 'rgba(100, 100, 255, 0.1)',
                        }}
                    />
                ) : null}
            </div>
            <MiniMap zoom={state.zoom} pan={state.pan} />
            {/* {!flashcard && (
                <div
                    style={{
                        position: 'absolute',
                        zIndex: 100,
                        backgroundColor: 'white',
                        padding: 12,
                        border: '1px solid #ccc',
                        top: 10,
                        left: 10,
                    }}
                >
                    <Key
                        cards={cards}
                        settings={settings.default}
                        settingsCol={settingsCol}
                        selectByTag={tag =>
                            selectAllWith(
                                card =>
                                    card.header == null &&
                                    (card.number == tag || card.letter === tag),
                            )
                        }
                    />
                </div>
            )} */}
            {flashcard ? (
                <FlashcardMode
                    cards={cards}
                    col={col}
                    tags={tags}
                    scales={scales}
                    onDone={() => setFlashcard(false)}
                />
            ) : null}
        </div>
    );
};

const styles = {};

const MiniMap = ({ zoom, pan }) => {
    const width = 100;
    const height = (BOUNDS.size.y / BOUNDS.size.x) * width;
    const iw = window.innerWidth / zoom / BOUNDS.size.x;
    const ih = window.innerHeight / zoom / BOUNDS.size.y;
    const x = (pan.x - BOUNDS.position.x) / BOUNDS.size.x;
    const y = (pan.y - BOUNDS.position.y) / BOUNDS.size.y;
    return (
        <div
            style={{
                position: 'absolute',
                right: 20,
                bottom: 20,
                width,
                height,
                backgroundColor: 'rgba(100,100,255,0.2)',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    backgroundColor: 'rgba(100,100,255,0.2)',
                    left: x * width,
                    top: y * height,
                    width: width * iw,
                    height: height * ih,
                }}
            />
        </div>
    );
};

const App = () => {
    return <Whiteboard />;
};

const root = document.createElement('div');
if (document.body) {
    document.body.appendChild(root);
    render(<App />, root);
}
