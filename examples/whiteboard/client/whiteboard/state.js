// @flow

import {
    type pos,
    type rect,
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
} from '../types';

export type State = {|
    pan: pos,
    zoom: number,
    drag?: ?Drag,
    dragSelect?: ?rect,
|};

export const initialState: State = {
    pan: { x: 0, y: 0 },
    zoom: 1,
    drag: null,
    dragSelect: null,
};

export type Selection = { [key: string]: boolean };

export type Drag = { offset: pos, mouse: pos, enough: boolean, screenPos: pos };

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
    | {| type: 'scroll', delta: pos, windowSize: pos |}
    | {| type: 'drag_scroll', delta: pos, drag: Drag, windowSize: pos |}
    | {| type: 'zoom', zoom: number, windowSize: pos |};
// | {|
//       type: 'replace_selection',
//       selection: { [key: string]: boolean },
//   |};

const objDiff = (one, two) => {
    const res = {};
    Object.keys(one).forEach(key => {
        if (!(key in two)) {
            res[key] = one[key];
        }
    });
    return res;
};

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
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
                        x: action.windowSize.x / state.zoom,
                        y: action.windowSize.y / state.zoom,
                    },
                    BOUNDS,
                ),
            };
        case 'drag_scroll':
            const pan = clamp(
                addPos(state.pan, action.delta),
                {
                    x: action.windowSize.x / state.zoom,
                    y: action.windowSize.y / state.zoom,
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
                        x: action.windowSize.x / action.zoom,
                        y: action.windowSize.y / action.zoom,
                    },
                    BOUNDS,
                ),
            };
        default:
            return state;
    }
};
