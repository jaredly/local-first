// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { createInMemoryDeltaClient } from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import { type Schema, type Collection } from '../../../packages/client-bundle';

const defaultCards = require('./data.json');

type CardT = {
    id: string,
    title: string,
    description: string,
    position: { x: number, y: number },
    size: { width: number, height: number },
    color: ?string,
    header: ?number,
    disabled: boolean,
};

const CardSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        description: 'string',
        position: {
            type: 'object',
            attributes: {
                x: 'number',
                y: 'number',
            },
        },
        size: {
            type: 'object',
            attributes: { width: 'number', height: 'number' },
        },
        color: { type: 'optional', value: 'string' },
        header: { type: 'optional', value: 'number' },
        disabled: 'boolean',
    },
};

const DEFAULT_HEIGHT = 70;
const DEFAULT_WIDTH = 200;
const DEFAULT_MARGIN = 12;
const BOUNDS = { x0: -500, y0: -500, x1: 1500, y1: 1500 };

const makeDefaultCards = genId => {
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
        size: { height: DEFAULT_HEIGHT, width: DEFAULT_WIDTH },
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
            };
        case 'set_drag':
            return {
                ...state,
                drag: action.drag,
            };
        case 'start_select':
            return {
                ...state,
                dragSelect: { origin: action.pos, mouse: action.pos },
            };
        case 'set_select':
            return {
                ...state,
                dragSelect: action.dragSelect,
            };
    }
    return state;
};

type pos = { x: number, y: number };

type State = {
    selection: { [key: string]: boolean },
    drag?: ?{ offset: pos, mouse: pos, enough: boolean },
    dragSelect?: ?{ origin: pos, mouse: pos },
};
type Action = any;

const initialState = {
    selection: {},
    drag: null,
    dragSelect: null,
};

const MIN_MOVEMENT = 10;

const addPos = (pos1, pos2) => ({ x: pos1.x + pos2.x, y: pos1.y + pos2.y });
const posDiff = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
// const threshhold = (pos, min) =>
//     Math.max(Math.abs(pos.x), Math.abs(pos.y)) > min ? pos : null;

const Card = React.memo(
    ({
        offset,
        card,
        col,
        selected,
        dispatch,
    }: {
        offset: ?pos,
        card: CardT,
        col: Collection<CardT>,
        selected: boolean,
        dispatch: Action => void,
    }) => {
        const pos = offset ? addPos(card.position, offset) : card.position;
        return (
            <div
                key={card.id}
                style={{
                    top: pos.y,
                    left: pos.x,
                    width: card.size.width,
                    height: card.size.height,
                }}
                css={[
                    {
                        padding: '4px 12px',
                        boxShadow: '0 0 3px #ccc',
                        position: 'absolute',
                        backgroundColor: selected ? 'aliceblue' : 'white',
                    },
                ]}
                onMouseDown={evt => {
                    dispatch({
                        type: 'start_drag',
                        pos: evtPos(evt),
                    });
                    if (!selected) {
                        dispatch({
                            type: evt.metaKey
                                ? 'add_selection'
                                : 'replace_selection',
                            selection: { [card.id]: true },
                        });
                    }
                }}
                // onClick={evt => {
                // }}
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
    // const currentDrag = React.useRef(state.drag);
    // currentDrag.current = state.drag;

    React.useEffect(() => {
        const move = evt => {
            if (currentState.current.drag) {
                const drag = currentState.current.drag;
                evt.preventDefault();
                evt.stopPropagation();
                const pos = evtPos(evt);
                const diff = posDiff(drag.offset, pos);
                dispatch({
                    type: 'set_drag',
                    drag: {
                        offset: drag.offset,
                        mouse: pos,
                        enough:
                            drag.enough ||
                            Math.max(Math.abs(diff.x), Math.abs(diff.y)) >
                                MIN_MOVEMENT,
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
            }
        };
        window.addEventListener('mousemove', move, true);
        window.addEventListener('mouseup', up, true);
        return () => {
            window.removeEventListener('mousemove', move, true);
            window.removeEventListener('mouseup', up, true);
        };
    }, []);

    const dragOffset =
        state.drag && state.drag.enough
            ? posDiff(state.drag.offset, state.drag.mouse)
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
                            offset={
                                dragOffset && state.selection[card.id]
                                    ? dragOffset
                                    : null
                            }
                            selected={state.selection[card.id]}
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
