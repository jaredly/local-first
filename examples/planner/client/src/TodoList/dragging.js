// @flow
import type { Collection } from '../../../../../packages/client-bundle';
import { type ItemT } from '../types';
import { type DragInit, type DragRefs } from './Item';

export type DragState = {
    started: boolean,
    dragging: DragInit,
    dest: ?{
        id: string,
        path: Array<string>,
        position: 'top' | 'bottom' | 'first-child',
        idx: number,
    },
    y: ?number,
    left: number,
    width: number,
};

const last = (arr) => arr[arr.length - 1];

const getPosition = (boxes, clientY, dragging): ?DragState => {
    const offsetParent = boxes[0].item.node.offsetParent;
    const offset = offsetParent.getBoundingClientRect().top;
    const y = clientY; // + offset; // include offsetTop?
    for (let i = 0; i < boxes.length; i++) {
        const current = boxes[i];
        const mid = (current.box.top + current.box.bottom) / 2;
        if (y < mid) {
            return {
                started: true,
                dragging,
                dest: {
                    id: current.item.id,
                    path: current.item.path,
                    position: 'top',
                    idx: current.item.idx,
                },
                y: current.box.top - offset,
                left: current.box.left,
                width: current.box.width,
            };
        } else if (i >= boxes.length - 1 || y < boxes[i + 1].box.top) {
            const leftOffset = current.item.parent ? 32 : 0;
            return {
                started: true,
                dragging,
                dest: {
                    id: current.item.id,
                    path: current.item.path,
                    position: current.item.parent ? 'first-child' : 'bottom',
                    idx: current.item.idx + 1,
                },
                y: current.box.bottom - offset,
                left: current.box.left + leftOffset,
                width: current.box.width - leftOffset,
            };
        }
    }
};

export const setupDragListeners = (
    dragRefs: DragRefs,
    currentDragger: { current: ?DragState },
    setDragger: (?DragState) => void,
    col: Collection<ItemT>,
) => {
    const positions = {};
    const boxes = Object.keys(dragRefs)
        .map((k) => ({ item: dragRefs[k], box: dragRefs[k].node.getBoundingClientRect() }))
        .sort((a, b) => a.box.top - b.box.top);
    const move = (evt) => {
        // console.log('ok', evt.clientY, evt);
        const { x, y } =
            evt.clientY == null
                ? evt.touches.length > 0
                    ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
                    : { x: 0, y: null }
                : { x: evt.clientX, y: evt.clientY };
        if (y == null) {
            return;
        }
        const current = currentDragger.current;
        if (!current) {
            return;
        }
        if (!current.started) {
            const pos = current.dragging.pos;
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist < 10) {
                return;
            }
        }
        if (current.dest == null) {
            current.dragging.onStart();
        }
        const position = getPosition(boxes, y, current.dragging);
        if (position) {
            if (
                position.dest &&
                (position.dest.id === position.dragging.id ||
                    position.dest.path.includes(position.dragging.id))
            ) {
                position.dest = null;
            }
            setDragger(position);
        }
    };
    const up = (evt) => {
        const dragger = currentDragger.current;
        if (!dragger) {
            return;
        }
        // console.log('move to', dragger);
        // ok instead of PID, need to use the whole
        // path, so we don't make loops.
        // STOPSHIP do the move actually
        const { dragging, dest } = dragger;
        if (dest && dest.id !== dragging.id) {
            const oldPid = last(dragging.path);
            const newPid = last(dest.path);
            if (dest.position === 'first-child') {
                if (dest.id === oldPid) {
                    // dunno what to do here
                    // STOPSHIP
                } else {
                    col.removeId(oldPid, ['children'], dragging.id);
                    col.insertId(dest.id, ['children'], 0, dragging.id);
                }
            } else if (oldPid === newPid) {
                // console.log(dest);
                col.reorderIdRelative(
                    newPid,
                    ['children'],
                    dragging.id,
                    dest.id,
                    dest.position === 'top',
                );
            } else {
                col.removeId(oldPid, ['children'], dragging.id);
                col.insertId(newPid, ['children'], dest.idx, dragging.id);
            }
        }
        dragging.onFinish();
        setDragger(null);
    };
    window.addEventListener('touchmove', move, true);
    window.addEventListener('touchend', up, true);
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    return () => {
        window.removeEventListener('touchmove', move, true);
        window.removeEventListener('touchend', up, true);
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('mouseup', up, true);
    };
};
