// @flow

import { type Drag, type State, type Action } from './state';
import { type CardT } from './types';

import { type Collection } from '../../../packages/client-bundle';

import {
    evtPos,
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    clamp,
    rectIntersect,
    fromScreen,
    BOUNDS,
} from './types';

const MIN_MOVEMENT = 5;

export const dragScroll = (drag: Drag, dispatch: Action => void) => {
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
};

export const onMove = (
    evt: MouseEvent,
    state: State,
    dispatch: Action => void,
    dragRef: { current: boolean },
) => {
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

export const onMouseUp = (
    evt: MouseEvent,
    state: State,
    cards: { [key: string]: CardT },
    dispatch: Action => void,
    col: Collection<CardT>,
) => {
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
            dispatch(
                evt.metaKey || evt.shiftKey
                    ? {
                          type: 'add_selection',
                          selection: newSelection,
                      }
                    : {
                          type: 'replace_selection',
                          selection: newSelection,
                      },
            );
        }
    }
};
