// @flow
import React from 'react';

import type { State, Action, Selection } from './state';

import {
    type Schema,
    type Collection,
    type Client,
    type SyncStatus,
} from '../../../../packages/client-bundle';

import { type pos, type rect, type CardT, CardSchema, evtPos, fromScreen } from '../types';

import { onMove, onMouseUp, dragScroll } from './dragUtils';

const useWhiteboardEvents = ({
    state,
    bounds,
    dispatch,
    onMoveItem,
    dragRef,
    selection,
    setSelection,
}: {
    state: State,
    dragRef: { current: boolean },
    bounds: { [key: string]: rect },
    dispatch: Action => void,
    onMoveItem: (string, pos) => void,
    selection: Selection,
    setSelection: Selection => void,
}) => {
    const currentState = React.useRef(state);
    currentState.current = state;
    const currentBounds = React.useRef(bounds);
    currentBounds.current = bounds;
    const currentSelection = React.useRef(selection);
    currentSelection.current = selection;

    const backgroundRef = React.useRef<?Node>(null);

    const currentHover = React.useRef<?string>(null);

    React.useEffect(() => {
        if (currentState.current.drag) {
            const timer = setInterval(() => {
                const drag = currentState.current.drag;
                if (drag && backgroundRef.current) {
                    // $FlowFixMe
                    const rect = backgroundRef.current.getBoundingClientRect();
                    const windowBounds = {
                        position: { x: rect.left, y: rect.top },
                        size: { x: rect.width, y: rect.height },
                    };
                    dragScroll(windowBounds, drag, dispatch);
                }
            }, 20);
            return () => {
                clearInterval(timer);
            };
        }
    }, [!!state.drag]);

    React.useEffect(() => {
        const move = evt => onMove(evt, currentState.current, dispatch, dragRef);
        const up = evt => {
            onMouseUp(
                evt,
                currentState.current,
                currentBounds.current,
                dispatch,
                onMoveItem,
                currentSelection.current,
                setSelection,
            );
        };
        const down = evt => {
            if (document.activeElement !== document.body) {
                return;
            }
            if (evt.target !== backgroundRef.current) {
                return;
            }
            // evt.preventDefault();
            const pos = fromScreen(
                evtPos(evt),
                currentState.current.pan,
                currentState.current.zoom,
            );
            dispatch({ type: 'start_select', pos });
            dragRef.current = false;
        };
        const mousewheel = evt => {
            if (backgroundRef.current) {
                dispatch({
                    type: 'scroll',
                    windowSize: getNodeSize(backgroundRef.current),
                    delta: {
                        x: evt.deltaX / state.zoom,
                        y: evt.deltaY / state.zoom,
                    },
                });
            }
        };
        window.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move, true);
        window.addEventListener('mouseup', up, true);
        window.addEventListener('mousewheel', mousewheel);
        return () => {
            window.removeEventListener('mousewheel', mousewheel);
            window.addEventListener('mousedown', down);
            window.removeEventListener('mousemove', move, true);
            window.removeEventListener('mouseup', up, true);
        };
    }, []);

    return { currentHover, backgroundRef };
};

export const getNodeSize = node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.width, y: rect.height };
};

export default useWhiteboardEvents;
