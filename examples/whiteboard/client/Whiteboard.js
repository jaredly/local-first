// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { useCollection } from '../../../packages/client-react';

import { type Client, type SyncStatus } from '../../../packages/client-bundle';

import useWhiteboardEvents from './useWhiteboardEvents';
import FlashcardMode from './FlashcardMode';
import Key from './Key';
import Welcome from './Welcome';
import ColumnButtons from './Columns';
import Hud from './Hud';

import { reducer, initialState, type State, type Action } from './state';

import MiniMap from './MiniMap';

import {
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

import { onMove, onMouseUp, dragScroll } from './dragUtils';

const Whiteboard = ({ client }: { client: Client<SyncStatus> }) => {
    const [col, cards] = useCollection<CardT, SyncStatus>(React, client, 'cards');
    const [tagsCol, tags] = useCollection<TagT, SyncStatus>(React, client, 'tags');
    const [scalesCol, scales] = useCollection<ScaleT, SyncStatus>(React, client, 'scales');
    const [commentsCol, comments] = useCollection<CommentT, SyncStatus>(React, client, 'comments');

    const [state, dispatch] = React.useReducer(reducer, initialState);
    const panZoom = React.useRef({ pan: state.pan, zoom: state.zoom });
    panZoom.current = { pan: state.pan, zoom: state.zoom };

    const { currentHover, dragRef } = useWhiteboardEvents({
        client,
        state,
        cards,
        dispatch,
        col,
    });

    const dragOffset =
        state.drag && state.drag.enough ? posDiff(state.drag.offset, state.drag.mouse) : null;
    const dragSelect = state.dragSelect ? normalizedRect(state.dragSelect) : null;

    const selectAllWith = React.useCallback(
        selector => {
            const matching = {};
            Object.keys(cards).forEach(k => {
                if (selector(cards[k])) {
                    matching[k] = true;
                }
            });
            dispatch({ type: 'replace_selection', selection: matching });
        },
        [cards],
    );

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
                <Hud
                    state={state}
                    dispatch={dispatch}
                    setFlashcard={setFlashcard}
                    client={client}
                    col={col}
                />
            ) : null}
            {Object.keys(state.selection).length > 1 ? (
                <ColumnButtons cards={cards} col={col} selection={state.selection} />
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
                            offset={dragOffset && state.selection[card.id] ? dragOffset : null}
                            selected={state.selection[card.id]}
                            hovered={dragSelect && rectIntersect(dragSelect, card)}
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
            <MiniMap zoom={state.zoom} pan={state.pan} BOUNDS={BOUNDS} />
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

export default Whiteboard;
