// @flow
import React from 'react';

import type { State, Action } from './state';

import {
    type Schema,
    type Collection,
    type Client,
    type SyncStatus,
} from '../../../packages/client-bundle';

import {
    type pos,
    type rect,
    type CardT,
    CardSchema,
    evtPos,
    fromScreen,
} from './types';

import { onMove, onMouseUp, dragScroll } from './dragUtils';
import { keyboardTags } from './keyboard';

const useWhiteboardEvents = ({
    client,
    state,
    cards,
    dispatch,
    col,
}: {
    client: Client<SyncStatus>,
    state: State,
    cards: { [key: string]: CardT },
    dispatch: Action => void,
    col: Collection<CardT>,
}) => {
    const currentState = React.useRef(state);
    currentState.current = state;
    const currentCards = React.useRef(cards);
    currentCards.current = cards;
    const dragRef = React.useRef<boolean>(false);

    const currentHover = React.useRef<?string>(null);

    React.useEffect(() => {
        if (currentState.current.drag) {
            const timer = setInterval(() => {
                const drag = currentState.current.drag;
                if (drag) {
                    dragScroll(drag, dispatch);
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

            keyboardTags(evt.key, keys, currentCards.current, col);
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

    return { currentHover, dragRef };
};

export default useWhiteboardEvents;
