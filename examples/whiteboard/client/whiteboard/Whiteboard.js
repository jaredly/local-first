// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';

import useWhiteboardEvents from './useWhiteboardEvents';

import { reducer, initialState, type State, type Action, type Selection } from './state';

import MiniMap from './MiniMap';

import { normalizedRect, posDiff, rectIntersect, BOUNDS, type rect, type pos } from '../types';

import { onMove, onMouseUp, dragScroll } from './dragUtils';

const Whiteboard = ({
    render,
    selection,
    setSelection,
    onMoveItem,
}: {
    render: ({
        dragRef: { current: boolean },
        panZoom: { current: { pan: pos, zoom: number } },
        dragOffset: ?pos,
        dragSelect: ?rect,
        dispatch: Action => void,
    }) => {
        children: React.Node,
        bounds: { [id: string]: rect },
    },
    selection: Selection,
    setSelection: Selection => void,
    onMoveItem: (string, pos) => void,
}) => {
    const [state, dispatch] = React.useReducer(reducer, initialState);
    const panZoom = React.useRef({ pan: state.pan, zoom: state.zoom });
    panZoom.current = { pan: state.pan, zoom: state.zoom };

    const dragOffset =
        state.drag && state.drag.enough ? posDiff(state.drag.offset, state.drag.mouse) : null;
    const dragSelect = state.dragSelect ? normalizedRect(state.dragSelect) : null;

    const dragRef = React.useRef<boolean>(false);
    const { children, bounds } = render({ dragRef, panZoom, dragOffset, dragSelect, dispatch });

    const { currentHover, backgroundRef } = useWhiteboardEvents({
        dragRef,
        state,
        bounds,
        dispatch,
        onMoveItem,
        selection,
        setSelection,
    });

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
            onClick={evt => {
                if (!dragRef.current) {
                    setSelection({});
                }
                dragRef.current = false;
            }}
        >
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
                {children}
                {dragSelect ? (
                    <div
                        style={{
                            position: 'absolute',
                            top: dragSelect.position.y,
                            left: dragSelect.position.x,
                            width: Math.max(5, dragSelect.size.x),
                            height: Math.max(5, dragSelect.size.y),
                            mouseEvents: 'none',
                            backgroundColor: 'rgba(100, 100, 255, 0.1)',
                        }}
                    />
                ) : null}
            </div>
            <MiniMap zoom={state.zoom} pan={state.pan} BOUNDS={BOUNDS} />
        </div>
    );
};

const noop = () => {};

export default Whiteboard;
