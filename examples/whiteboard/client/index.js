// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { createInMemoryDeltaClient } from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import { type Schema, type Collection } from '../../../packages/client-bundle';

import {
    type pos,
    type rect,
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

const defaultCards = require('./data.json');

const DEFAULT_HEIGHT = 70;
const DEFAULT_WIDTH = 200;
const DEFAULT_MARGIN = 12;

const makeDefaultCards = (genId): Array<CardT> => {
    return defaultCards.map(({ description, title }, i) => ({
        id: genId(),
        title,
        description,
        position: {
            x:
                DEFAULT_MARGIN +
                parseInt(i / 10) * (DEFAULT_WIDTH + DEFAULT_MARGIN),
            y:
                DEFAULT_MARGIN +
                100 +
                (i % 10) * (DEFAULT_HEIGHT + DEFAULT_MARGIN),
        },
        size: { y: DEFAULT_HEIGHT, x: DEFAULT_WIDTH },
        disabled: false,
    }));
};

const objDiff = (one, two) => {
    const res = {};
    Object.keys(one).forEach(key => {
        if (!(key in two)) {
            res[key] = one[key];
        }
    });
    return res;
};

const reducer = (state: State, action): State => {
    switch (action.type) {
        case 'replace_selection':
            return { ...state, selection: action.selection };
        case 'add_selection':
            return {
                ...state,
                // $FlowFixMe
                selection: { ...state.selection, ...action.selection },
            };
        case 'remove_selection':
            return {
                ...state,
                selection: objDiff(state.selection, action.selection),
            };
        case 'start_drag':
            return {
                ...state,
                drag: {
                    offset: action.pos,
                    mouse: action.pos,
                    enough: false,
                    screenPos: action.screenPos,
                },
                dragSelect: null,
            };
        case 'set_drag':
            return {
                ...state,
                drag: action.drag,
                dragSelect: null,
            };
        case 'start_select':
            return {
                ...state,
                dragSelect: { position: action.pos, size: { x: 0, y: 0 } },
                drag: null,
            };
        case 'set_select':
            return {
                ...state,
                dragSelect: action.dragSelect,
                drag: null,
            };
        case 'scroll':
            return {
                ...state,
                pan: clamp(
                    addPos(state.pan, action.delta),
                    {
                        x: window.innerWidth / state.zoom,
                        y: window.innerHeight / state.zoom,
                    },
                    BOUNDS,
                ),
            };
        case 'drag_scroll':
            const pan = clamp(
                addPos(state.pan, action.delta),
                {
                    x: window.innerWidth / state.zoom,
                    y: window.innerHeight / state.zoom,
                },
                BOUNDS,
            );
            const diff = posDiff(state.pan, pan);
            return {
                ...state,
                pan,
                drag: {
                    ...action.drag,
                    mouse: addPos(action.drag.mouse, diff),
                },
            };
        case 'zoom':
            return {
                ...state,
                zoom: action.zoom,
                pan: clamp(
                    state.pan,
                    {
                        x: window.innerWidth / action.zoom,
                        y: window.innerHeight / action.zoom,
                    },
                    BOUNDS,
                ),
            };
        default:
            return state;
    }
};

export type Drag = { offset: pos, mouse: pos, enough: boolean, screenPos: pos };
export type State = {
    selection: { [key: string]: boolean },
    pan: pos,
    zoom: number,
    drag?: ?Drag,
    dragSelect?: ?rect,
};

export type Action =
    | {|
          type: 'set_drag',
          drag: ?Drag,
      |}
    | {|
          type: 'set_select',
          dragSelect: ?rect,
      |}
    | {|
          type: 'start_drag',
          pos: {| x: number, y: number |},
          screenPos: pos,
      |}
    | {|
          type: 'start_select',
          pos: {| x: number, y: number |},
      |}
    | {|
          type: 'add_selection',
          selection: { [key: string]: boolean },
      |}
    | {|
          type: 'remove_selection',
          selection: { [key: string]: boolean },
      |}
    | {| type: 'scroll', delta: pos |}
    | {| type: 'drag_scroll', delta: pos, drag: Drag |}
    | {| type: 'zoom', zoom: number |}
    | {|
          type: 'replace_selection',
          selection: { [key: string]: boolean },
      |};

const initialState = {
    selection: {},
    pan: { x: 0, y: 0 },
    zoom: 1,
    drag: null,
    dragSelect: null,
};

const MIN_MOVEMENT = 5;

const onMove = (evt, state, dispatch, dragRef) => {
    if (state.drag) {
        const drag = state.drag;
        evt.preventDefault();
        evt.stopPropagation();
        const screenPos = evtPos(evt);
        const pos = fromScreen(screenPos, state.pan, state.zoom);
        const diff = posDiff(drag.offset, pos);
        const enough =
            drag.enough ||
            Math.max(Math.abs(diff.x), Math.abs(diff.y)) > MIN_MOVEMENT;
        if (enough) {
            dragRef.current = true;
        }
        dispatch({
            type: 'set_drag',
            drag: {
                offset: drag.offset,
                mouse: pos,
                enough: enough,
                screenPos,
            },
        });
        if (screenPos.x > window.innerWidth - 50) {
            dispatch({ type: 'pan' });
        }
    } else if (state.dragSelect) {
        const { dragSelect } = state;
        evt.preventDefault();
        evt.stopPropagation();
        const pos = fromScreen(evtPos(evt), state.pan, state.zoom);
        const enough = absMax(posDiff(dragSelect.position, pos)) > MIN_MOVEMENT;
        if (enough) {
            dragRef.current = true;
        }
        dispatch({
            type: 'set_select',
            dragSelect: {
                position: dragSelect.position,
                size: posDiff(dragSelect.position, pos),
            },
        });
    }
};

const onMouseUp = (evt, state, cards, dispatch, col) => {
    if (state.drag) {
        const drag = state.drag;
        if (drag.enough) {
            const diff = posDiff(drag.offset, drag.mouse);
            Object.keys(state.selection).forEach(key => {
                col.setAttribute(
                    key,
                    ['position'],
                    clamp(
                        addPos(cards[key].position, diff),
                        cards[key].size,
                        BOUNDS,
                    ),
                );
            });
        }
        evt.preventDefault();
        evt.stopPropagation();
        dispatch({ type: 'set_drag', drag: null });
    } else if (state.dragSelect) {
        const { dragSelect } = state;
        const newSelection = {};
        let anySelected = false;
        Object.keys(cards).forEach(key => {
            if (
                rectIntersect(
                    {
                        position: cards[key].position,
                        size: cards[key].size,
                    },
                    normalizedRect(dragSelect),
                )
            ) {
                anySelected = true;
                newSelection[key] = true;
            }
        });
        dispatch({ type: 'set_select', dragSelect: null });
        if (anySelected) {
            dispatch({
                type: evt.metaKey ? 'add_selection' : 'replace_selection',
                selection: newSelection,
            });
        }
    }
};

const arrangeCards = (
    cards: { [key: string]: CardT },
    selection,
    columns,
    collection,
) => {
    // if they're already roughly in a grid, it would be nice to maintain that...
    const selectedCards = Object.keys(selection).map(key => cards[key]);
    selectedCards.sort((c1, c2) => {
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

const Whiteboard = () => {
    // we're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            createInMemoryDeltaClient(
                { cards: CardSchema },
                `ws://localhost:9090/ephemeral/sync`,
            ),
        [],
    );
    const [col, cards] = useCollection(React, client, 'cards');

    const [state, dispatch] = React.useReducer(reducer, initialState);
    const currentState = React.useRef(state);
    currentState.current = state;
    const currentCards = React.useRef(cards);
    currentCards.current = cards;
    const dragRef = React.useRef(false);
    const panZoom = React.useRef({ pan: state.pan, zoom: state.zoom });
    panZoom.current = { pan: state.pan, zoom: state.zoom };

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
            if (evt.key === 'z' && evt.metaKey) {
                client.undo();
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
            if (!dragRef.current && !evt.metaKey) {
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

    return (
        <div>
            <div
                style={{
                    position: 'absolute',
                    zIndex: 10000,
                    boxShadow: '0 0 2px #666',
                    backgroundColor: 'white',
                    padding: 4,
                }}
                onClick={evt => evt.stopPropagation()}
            >
                <button
                    onClick={() => {
                        makeDefaultCards(client.getStamp).forEach(card => {
                            col.save(card.id, card);
                        });
                    }}
                >
                    Add default cards
                </button>
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
                />
                {Object.keys(state.selection).length > 1 ? (
                    <div>
                        <button
                            onClick={() => {
                                arrangeCards(cards, state.selection, 1, col);
                            }}
                        >
                            1
                        </button>
                        <button
                            onClick={() => {
                                arrangeCards(cards, state.selection, 2, col);
                            }}
                        >
                            2
                        </button>
                        <button
                            onClick={() => {
                                arrangeCards(cards, state.selection, 3, col);
                            }}
                        >
                            3
                        </button>
                    </div>
                ) : null}
            </div>
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
                            key={card.id}
                            dragRef={dragRef}
                            panZoom={panZoom}
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
        </div>
    );
};

const MiniMap = ({ zoom, pan }) => {
    const width = 100;
    const height = (BOUNDS.size.y / BOUNDS.size.x) * width;
    const iw = window.innerWidth / zoom / BOUNDS.size.x;
    const ih = window.innerHeight / zoom / BOUNDS.size.y;
    const x = (pan.x - BOUNDS.position.x) / BOUNDS.size.x; // - window.innerWidth);
    const y = (pan.y - BOUNDS.position.y) / BOUNDS.size.y; // - window.innerHeight);
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

// const setupDelta = () => {
//     return createDeltaClient(
//         newCrdt,
//         schemas,
//         new PersistentClock(localStorageClockPersist('local-first')),
//         makeDeltaPersistence('local-first', ['tasks', 'notes']),
//         createWebSocketNetwork('ws://localhost:9900/sync'),
//     );
// };
