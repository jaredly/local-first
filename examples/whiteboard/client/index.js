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
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    rectIntersect,
} from './types';

const defaultCards = require('./data.json');

const DEFAULT_HEIGHT = 70;
const DEFAULT_WIDTH = 200;
const DEFAULT_MARGIN = 12;
const BOUNDS = { x0: -500, y0: -500, x1: 1500, y1: 1500 };

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
    }
    return state;
};

type Drag = { offset: pos, mouse: pos, enough: boolean };
type State = {
    selection: { [key: string]: boolean },
    drag?: ?Drag,
    dragSelect?: ?rect,
};
type Action =
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
    | {|
          type: 'replace_selection',
          selection: { [key: string]: boolean },
      |};

const initialState = {
    selection: {},
    drag: null,
    dragSelect: null,
};

const MIN_MOVEMENT = 5;

const Card = React.memo(
    ({
        offset,
        card,
        col,
        selected,
        hovered,
        dispatch,
        dragRef,
    }: {
        offset: ?pos,
        card: CardT,
        col: Collection<CardT>,
        selected: boolean,
        hovered: ?boolean,
        dispatch: Action => void,
        dragRef: { current: boolean },
    }) => {
        const pos = offset ? addPos(card.position, offset) : card.position;
        // const downPos = React.useRef(null);
        return (
            <div
                key={card.id}
                style={{
                    top: pos.y,
                    left: pos.x,
                    width: card.size.x,
                    height: card.size.y,
                    backgroundColor:
                        selected || hovered ? 'aliceblue' : 'white',
                }}
                css={{
                    padding: '4px 12px',
                    boxShadow: '0 0 3px #ccc',
                    position: 'absolute',
                }}
                onMouseDown={evt => {
                    const pos = evtPos(evt);
                    dispatch({
                        type: 'start_drag',
                        pos,
                    });
                    dragRef.current = false;
                    // downPos.current = pos;
                    if (!selected) {
                        dispatch(
                            evt.metaKey
                                ? {
                                      type: 'add_selection',
                                      selection: { [card.id]: true },
                                  }
                                : {
                                      type: 'replace_selection',
                                      selection: { [card.id]: true },
                                  },
                        );
                    } else if (evt.metaKey) {
                        dispatch({
                            type: 'remove_selection',
                            selection: { [card.id]: true },
                        });
                    }
                    evt.stopPropagation();
                }}
                onClick={evt => {
                    evt.stopPropagation();
                    if (dragRef.current) {
                        return;
                    }
                    if (selected && !evt.metaKey) {
                        dispatch({
                            type: 'replace_selection',
                            selection: { [card.id]: true },
                        });
                    }
                }}
            >
                <div
                    style={{
                        fontWeight: 'bold',
                        marginBottom: 4,
                        textAlign: 'center',
                    }}
                >
                    {card.title}
                </div>
                <div
                    style={{
                        fontSize: '80%',
                    }}
                >
                    {card.description}
                </div>
            </div>
        );
    },
);

const evtPos = evt => ({ x: evt.clientX, y: evt.clientY });

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
        const move = evt => {
            if (currentState.current.drag) {
                const drag = currentState.current.drag;
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
            } else if (currentState.current.dragSelect) {
                const { dragSelect } = currentState.current;
                evt.preventDefault();
                evt.stopPropagation();
                const pos = evtPos(evt);
                const enough =
                    absMax(posDiff(dragSelect.position, pos)) > MIN_MOVEMENT;
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
        const up = evt => {
            if (currentState.current.drag) {
                const drag = currentState.current.drag;
                if (drag.enough) {
                    const diff = posDiff(drag.offset, drag.mouse);
                    Object.keys(currentState.current.selection).forEach(key => {
                        col.setAttribute(
                            key,
                            ['position'],
                            addPos(currentCards.current[key].position, diff),
                        );
                    });
                }
                evt.preventDefault();
                evt.stopPropagation();
                dispatch({ type: 'set_drag', drag: null });
            } else if (currentState.current.dragSelect) {
                const { dragSelect } = currentState.current;
                const newSelection = {};
                let anySelected = false;
                Object.keys(currentCards.current).forEach(key => {
                    if (
                        rectIntersect(
                            {
                                position: currentCards.current[key].position,
                                size: currentCards.current[key].size,
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
                        type: evt.metaKey
                            ? 'add_selection'
                            : 'replace_selection',
                        selection: newSelection,
                    });
                }
            }
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
        window.addEventListener('click', click);
        window.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move, true);
        window.addEventListener('mouseup', up, true);
        window.addEventListener('keydown', key);
        return () => {
            window.removeEventListener('click', click);
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
            <div>
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
