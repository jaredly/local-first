// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import { useCollection } from '../../../packages/client-react';

import { type Client, type SyncStatus } from '../../../packages/client-bundle';

import useWhiteboardEvents from './whiteboard/useWhiteboardEvents';
import FlashcardMode from './FlashcardMode';
import Key from './Key';
import Welcome from './Welcome';
import ColumnButtons from './Columns';
import Hud from './Hud';

import { reducer, initialState, type State, type Action } from './whiteboard/state';

import MiniMap from './whiteboard/MiniMap';
import TagsUI from './TagsUI';

import {
    type TagT,
    TagSchema,
    type ScaleT,
    ScaleSchema,
    type CommentT,
    CommentSchema,
    type CardT,
    CardSchema,
    normalizedRect,
    posDiff,
    rectIntersect,
    BOUNDS,
} from './types';

import Card from './Card';
import Card2 from './Card2';
import {
    makeDefaultCards,
    makeDefaultHeadings,
    makeDefaultTags,
    makeDefaultScales,
} from './defaults';
import { type Collection } from '../../../packages/client-bundle';

import Whiteboard from './whiteboard/Whiteboard';
import { onMove, onMouseUp, dragScroll } from './dragUtils';

const objDiff = (one, two) => {
    const res = {};
    Object.keys(one).forEach(key => {
        if (!(key in two)) {
            res[key] = one[key];
        }
    });
    return res;
};

export type SelectionAction =
    | {|
          type: 'add',
          selection: { [key: string]: boolean },
      |}
    | {|
          type: 'remove',
          selection: { [key: string]: boolean },
      |}
    | {|
          type: 'replace',
          selection: { [key: string]: boolean },
      |};

const selectionReducer = (state, action: SelectionAction) => {
    switch (action.type) {
        case 'replace':
            return action.selection;
        case 'add':
            return {
                ...state.selection,
                ...action.selection,
            };
        case 'remove':
            return objDiff(state, action.selection);
        default:
            return state;
    }
};

const WhiteboardWrapper = ({
    client,
    cards,
    setFlashcard,
    col,
    tagsCol,
    scalesCol,
    scales,
    tags,
}: {
    col: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    client: Client<SyncStatus>,
    setFlashcard: boolean => void,
}) => {
    const [selection, dispatchSelection] = React.useReducer(selectionReducer, {});

    const selectAllWith = React.useCallback(
        selector => {
            const matching = {};
            Object.keys(cards).forEach(k => {
                if (selector(cards[k])) {
                    matching[k] = true;
                }
            });
            dispatchSelection({ type: 'replace', selection: matching });
        },
        [cards],
    );

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
            }}
        >
            {/* <Hud
                setFlashcard={setFlashcard}
                client={client}
                col={col}
            /> */}
            {Object.keys(selection).length > 1 ? (
                <ColumnButtons cards={cards} col={col} selection={selection} />
            ) : null}
            <Whiteboard
                selection={selection}
                setSelection={selection => dispatchSelection({ type: 'replace', selection })}
                onMoveItem={(id, pos) => {
                    col.setAttribute(id, ['position'], pos);
                }}
                render={({ dragRef, panZoom, dragOffset, dragSelect, dispatch }) => {
                    const bounds = {};
                    return {
                        children: (
                            <React.Fragment>
                                {Object.keys(cards)
                                    .map(id => cards[id])
                                    .map(card => {
                                        bounds[card.id] = {
                                            position: card.position,
                                            size: card.size,
                                        };
                                        return (
                                            <Card2
                                                selectAllWith={selectAllWith}
                                                key={card.id}
                                                dragRef={dragRef}
                                                panZoom={panZoom}
                                                tags={tags}
                                                dispatch={dispatch}
                                                dispatchSelection={dispatchSelection}
                                                scales={scales}
                                                offset={
                                                    dragOffset && selection[card.id]
                                                        ? dragOffset
                                                        : null
                                                }
                                                selected={selection[card.id]}
                                                hovered={
                                                    dragSelect && rectIntersect(dragSelect, card)
                                                }
                                                card={card}
                                                col={col}
                                            />
                                        );
                                    })}
                            </React.Fragment>
                        ),
                        bounds,
                    };
                }}
            />
            <TagsUI
                cards={cards}
                cardsCol={col}
                selection={selection}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                setKey={noop}
                clearKey={noop}
                genId={client.getStamp}
            />
        </div>
    );
};

const Whiteboard_old = ({
    client,
    cards,
    setFlashcard,
    col,
    tagsCol,
    scalesCol,
    scales,
    tags,
}: {
    col: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    client: Client<SyncStatus>,
    setFlashcard: boolean => void,
}) => {
    const [state, dispatch] = React.useReducer(reducer, initialState);
    const panZoom = React.useRef({ pan: state.pan, zoom: state.zoom });
    panZoom.current = { pan: state.pan, zoom: state.zoom };

    const { currentHover, dragRef, backgroundRef } = useWhiteboardEvents({
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

    return (
        <div
            ref={node => (backgroundRef.current = node)}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
            }}
        >
            <Hud
                state={state}
                dispatch={dispatch}
                setFlashcard={setFlashcard}
                client={client}
                col={col}
            />
            {Object.keys(state.selection).length > 1 ? (
                <ColumnButtons cards={cards} col={col} selection={state.selection} />
            ) : null}

            {/* the movable board */}
            <div
                style={{
                    position: 'absolute',
                    top: -state.pan.y * state.zoom,
                    left: -state.pan.x * state.zoom,
                    transform: `scale(${state.zoom.toFixed(2)})`,
                    mouseEvents: 'none',
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
            <TagsUI
                cards={cards}
                cardsCol={col}
                selection={state.selection}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                setKey={noop}
                clearKey={noop}
                genId={client.getStamp}
            />
        </div>
    );
};

const noop = () => {};

const Main = ({ client }: { client: Client<SyncStatus> }) => {
    const [col, cards] = useCollection<CardT, SyncStatus>(React, client, 'cards');
    const [tagsCol, tags] = useCollection<TagT, SyncStatus>(React, client, 'tags');
    const [scalesCol, scales] = useCollection<ScaleT, SyncStatus>(React, client, 'scales');
    const [commentsCol, comments] = useCollection<CommentT, SyncStatus>(React, client, 'comments');

    const [flashcard, setFlashcard] = React.useState(true);

    if (!Object.keys(cards).length) {
        return (
            <Welcome
                onStart={() => {
                    makeDefaultTags(client.getStamp).forEach(tag => {
                        tagsCol.save(tag.id, tag);
                    });
                    makeDefaultScales(client.getStamp).forEach(scale => {
                        scalesCol.save(scale.id, scale);
                    });
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

    if (flashcard) {
        return (
            <FlashcardMode
                cards={cards}
                col={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                onDone={() => setFlashcard(false)}
                genId={client.getStamp}
            />
        );
    } else {
        return (
            <WhiteboardWrapper
                setFlashcard={setFlashcard}
                client={client}
                cards={cards}
                col={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
            />
        );
    }
};

export default Main;
