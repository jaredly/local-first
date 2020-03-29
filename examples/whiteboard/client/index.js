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
} from './types';

import Card from './Card';

const defaultCards = require('./data.json');

const DEFAULT_HEIGHT = 70;
const DEFAULT_WIDTH = 200;
const DEFAULT_MARGIN = 12;
const BOUNDS = { position: { x: -500, y: -500 }, size: { x: 1500, y: 1500 } };

const makeDefaultCards = (genId): Array<CardT> => {
    return defaultCards.map(({ description, title }, i) => ({
        id: genId(),
        title,
        description,
        position: {
            x:
                DEFAULT_MARGIN +
                parseInt(i / 10) * (DEFAULT_WIDTH + DEFAULT_MARGIN),
            y: DEFAULT_MARGIN + (i % 10) * (DEFAULT_HEIGHT + DEFAULT_MARGIN),
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
                drag: { offset: action.pos, mouse: action.pos, enough: false },
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
                pan: clamp(addPos(state.pan, action.delta), BOUNDS),
            };
        default:
            return state;
    }
};

export type Drag = { offset: pos, mouse: pos, enough: boolean };
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
        const pos = evtPos(evt);
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
            },
        });
    } else if (state.dragSelect) {
        const { dragSelect } = state;
        evt.preventDefault();
        evt.stopPropagation();
        const pos = evtPos(evt);
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
                    addPos(cards[key].position, diff),
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
        // console.log('ok', dragSelect, anySelected, newSelection);
        dispatch({ type: 'set_select', dragSelect: null });
        if (anySelected) {
            dispatch({
                type: evt.metaKey ? 'add_selection' : 'replace_selection',
                selection: newSelection,
            });
        }
    }
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
            const pos = evtPos(evt);
            dispatch({ type: 'start_select', pos });
            dragRef.current = false;
        };
        const click = evt => {
            if (!dragRef.current && !evt.metaKey) {
                dispatch({ type: 'replace_selection', selection: {} });
            }
        };
        const mousewheel = evt => {
            console.log(evt.deltaX, evt.deltaY);
            dispatch({
                type: 'scroll',
                delta: { x: evt.deltaX, y: evt.deltaY },
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

    const dragOffset =
        state.drag && state.drag.enough
            ? posDiff(state.drag.offset, state.drag.mouse)
            : null;
    const dragSelect = state.dragSelect
        ? normalizedRect(state.dragSelect)
        : null;

    return (
        <div>
            Oy
            <button
                onClick={() => {
                    makeDefaultCards(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                }}
            >
                Add default cards
            </button>
            <div
                style={{
                    position: 'absolute',
                    top: 20 - state.pan.y,
                    left: -state.pan.x,
                }}
            >
                {Object.keys(cards)
                    .map(id => cards[id])
                    .map(card => (
                        <Card
                            key={card.id}
                            dragRef={dragRef}
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
            </div>
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
