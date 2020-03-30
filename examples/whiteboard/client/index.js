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

import {
    type pos,
    type rect,
    type SettingsT,
    type CardT,
    CardSchema,
    SettingsSchema,
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
1;
const makeDefaultHeadings = (genId): Array<CardT> => {
    const titles = `
Most Important to Me
Very Important To Me
Important To Me
Somewhat Important to Me
Not Important to Me
`
        .trim()
        .split('\n')
        .map(title => title.trim());
    return titles.map((title, i) => ({
        id: genId(),
        title,
        description: '',
        number: null,
        letter: null,
        position: {
            x: DEFAULT_MARGIN + i * (DEFAULT_WIDTH * 2.0 + DEFAULT_MARGIN),
            y: DEFAULT_MARGIN + 50,
        },
        size: { y: DEFAULT_HEIGHT, x: DEFAULT_WIDTH * 2.0 },
        header: 1,
        disabled: false,
    }));
};

const shuffle = array => {
    return array
        .map(item => [Math.random(), item])
        .sort((a, b) => a[0] - b[0])
        .map(item => item[1]);
};

const makeDefaultCards = (genId): Array<CardT> => {
    return shuffle(defaultCards).map(({ description, title }, i): CardT => ({
        id: genId(),
        title,
        description,
        number: null,
        letter: null,
        header: null,
        position: {
            x:
                DEFAULT_MARGIN +
                parseInt(i / 10) * (DEFAULT_WIDTH + DEFAULT_MARGIN),
            y:
                DEFAULT_MARGIN +
                500 +
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
                type:
                    evt.metaKey || evt.shiftKey
                        ? 'add_selection'
                        : 'replace_selection',
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

const AddCard = ({ onAdd }) => {
    const [adding, setAdding] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [header, setHeader] = React.useState(null);
    return (
        <div>
            <button onClick={() => setAdding(true)}>+ Card</button>
            {adding ? (
                <div
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        width: 300,
                        height: 200,
                        marginLet: -150,
                        marginTop: -100,
                        backgroundColor: 'white',
                        margin: 32,
                        boxShadow: '0 0 5px #666',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <strong>
                        Add a {header === null ? 'normal' : 'header'} card
                    </strong>
                    <button
                        onClick={() => setHeader(header === null ? 1 : null)}
                    >
                        {header !== null ? 'Header card' : 'Normal card'}
                    </button>
                    <input
                        style={{ display: 'block' }}
                        onChange={evt => setTitle(evt.target.value)}
                        value={title}
                        placeholder="Title"
                    />
                    <input
                        style={{ display: 'block' }}
                        onChange={evt => setDescription(evt.target.value)}
                        value={description}
                        placeholder="Description"
                    />
                    <button
                        onClick={() => {
                            onAdd(title, description, header);
                            setAdding(false);
                            setTitle('');
                            setDescription('');
                        }}
                    >
                        Save
                    </button>
                    <button
                        onClick={() => {
                            setAdding(false);
                            setTitle('');
                            setDescription('');
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : null}
        </div>
    );
};

const Whiteboard = () => {
    // we're assuming we're authed, and cookies are taking care of things.
    const client = React.useMemo(
        () =>
            createPersistedBlobClient(
                'hello',
                { cards: CardSchema, settings: SettingsSchema },
                null,
                2,
            ),
        // createInMemoryDeltaClient(
        //     { cards: CardSchema },
        //     `ws://localhost:9090/ephemeral/sync`,
        // ),
        [],
    );
    const [col, cards] = useCollection(React, client, 'cards');
    const [settingsCol, settings] = useCollection(React, client, 'settings');

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

            if (evt.key === '!') {
                return arrangeCards(
                    currentCards.current,
                    currentState.current.selection,
                    1,
                    col,
                );
            }
            if (evt.key === '@') {
                return arrangeCards(
                    currentCards.current,
                    currentState.current.selection,
                    2,
                    col,
                );
            }
            if (evt.key === '#') {
                return arrangeCards(
                    currentCards.current,
                    currentState.current.selection,
                    3,
                    col,
                );
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
            <div
                css={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <h1>Welcome to the Miller Card Sort!</h1>
                <h4>Instructions</h4>
                <ul>
                    <li>Drag cards around</li>
                    <li>
                        Hover a card &amp; press a number or letter key to "tag"
                        the card
                    </li>
                    <li>Click a tag to select all cards with that tag</li>
                    <li>
                        use shift+1, shift+2, and shift+3 to organize selected
                        cards into 1, 2 or 3 columns
                    </li>
                </ul>
                <button
                    css={{
                        marginTop: 32,
                        fontSize: '2em',
                        border: 'none',
                        backgroundColor: '#0af',
                        padding: '8px 16px',
                        borderRadius: 8,
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        makeDefaultHeadings(client.getStamp).forEach(card => {
                            col.save(card.id, card);
                        });
                        makeDefaultCards(client.getStamp).forEach(card => {
                            col.save(card.id, card);
                        });
                    }}
                >
                    Click here to get started
                </button>
            </div>
        );
    }

    return (
        <div>
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
                {/* <AddHeader col={col} /> */}
            </div>
            {Object.keys(state.selection).length > 1 ? (
                <div
                    style={{
                        position: 'absolute',
                        zIndex: 1000,
                        left: '50%',
                        // marginLeft: '-50%',
                        top: 0,
                    }}
                    onClick={evt => evt.stopPropagation()}
                    onMouseDown={evt => evt.stopPropagation()}
                >
                    <button
                        style={{
                            border: '1px solid #ccc',
                            padding: '4px 12px',
                            backgroundColor: 'white',
                            fontSize: 24,
                        }}
                        onClick={() => {
                            arrangeCards(cards, state.selection, 1, col);
                        }}
                    >
                        {/* 1 column */}
                        ||
                    </button>
                    <button
                        style={{
                            border: '1px solid #ccc',
                            padding: '4px 12px',
                            backgroundColor: 'white',
                            fontSize: 24,
                            marginLeft: 12,
                        }}
                        onClick={() => {
                            arrangeCards(cards, state.selection, 2, col);
                        }}
                    >
                        {/* 2 columns */}
                        |||
                    </button>
                    <button
                        style={{
                            border: '1px solid #ccc',
                            padding: '4px 12px',
                            backgroundColor: 'white',
                            fontSize: 24,
                            marginLeft: 12,
                        }}
                        onClick={() => {
                            arrangeCards(cards, state.selection, 3, col);
                        }}
                    >
                        {/* 3 columns */}
                        ||||
                    </button>
                </div>
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
                            settings={settings.default}
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
            {!flashcard && (
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
                    />
                </div>
            )}
            {flashcard ? (
                <FlashcardMode
                    cards={cards}
                    col={col}
                    settings={settings.default}
                    settingsCol={settingsCol}
                    onDone={() => setFlashcard(false)}
                />
            ) : null}
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
