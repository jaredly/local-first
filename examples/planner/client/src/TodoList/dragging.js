// @flow
// export type Dest = {
//     id: string,
//     path: Array<string>,
//     position: 'top' | 'bottom' | 'first-child',
//     idx: number,
// };

export type DragInit = {
    id: string,
    path: Array<string>,
    onStart: () => void,
    onFinish: () => void,
    pos: { x: number, y: number },
};

export type DragState<Dest> = {
    started: boolean,
    dragging: DragInit,
    dest: ?Dest,
    y: ?number,
    left: number,
    width: number,
};

const inside = (x, box) => box.left <= x && x <= box.left + box.width;

const getPosition = function <Dest>(
    boxes: Array<DropTarget<Dest>>,
    pos: { x: number, y: number },
    limitX: boolean,
    dragging,
): ?DragState<Dest> {
    const offsetParent = boxes[0].offsetParent;
    const offset = offsetParent ? offsetParent.getBoundingClientRect().top : 0;
    for (let i = 0; i < boxes.length; i++) {
        if (limitX && !inside(pos.x, boxes[i])) {
            continue;
        }
        // if we're closer to the current than the next one, go with it
        const d0 = Math.abs(pos.y - boxes[i].y);
        const dNext =
            i < boxes.length - 1
                ? limitX && !inside(pos.x, boxes[i])
                    ? Infinity
                    : Math.abs(pos.y - boxes[i + 1].y)
                : Infinity;
        if (d0 < dNext) {
            return {
                started: true,
                dragging,
                dest: boxes[i].contents,
                y: boxes[i].y - offset,
                left: boxes[i].left,
                width: boxes[i].width,
            };
        }
    }
    return null;
    // for (let i = 0; i < boxes.length; i++) {
    //     const current = boxes[i];
    //     const mid = (current.box.top + current.box.bottom) / 2;
    //     if (y < mid) {
    //         return {
    //             started: true,
    //             dragging,
    //             dest: {
    //                 id: current.item.id,
    //                 path: current.item.path,
    //                 position: 'top',
    //                 idx: current.item.idx,
    //             },
    //             y: current.box.top - offset,
    //             left: current.box.left,
    //             width: current.box.width,
    //         };
    //     } else if (i >= boxes.length - 1 || y < boxes[i + 1].box.top) {
    //         const leftOffset = current.item.parent ? 32 : 0;
    //         return {
    //             started: true,
    //             dragging,
    //             dest: {
    //                 id: current.item.id,
    //                 path: current.item.path,
    //                 position: current.item.parent ? 'first-child' : 'bottom',
    //                 idx: current.item.idx + 1,
    //             },
    //             y: current.box.bottom - offset,
    //             left: current.box.left + leftOffset,
    //             width: current.box.width - leftOffset,
    //         };
    //     }
    // }
};

const getMainEvtPos = (evt) =>
    evt.clientY == null
        ? evt.touches.length > 0
            ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
            : null
        : { x: evt.clientX, y: evt.clientY };

// So we want a function that turns
// the dragRefs
// into a series of y positions.
// and then we can just do "what are we closest to"
// probably with an optional "targetOffset" to show the line
// in a slightly different place

export type DropTarget<T> = {
    y: number,
    left: number,
    width: number,
    offsetParent: ?Element,
    contents: T,
};

export const setupDragListeners = function <Dest: {}>(
    dropTargets: Array<DropTarget<Dest>>,
    // dragRefs: DragRefs,
    currentDragger: { current: ?DragState<Dest> },
    limitX: boolean,
    setDragger: (?DragState<Dest>) => void,
    onDrop: (DragInit, Dest) => void,
) {
    const positions = {};

    // const boxes = Object.keys(dragRefs)
    //     .map((k) => ({ item: dragRefs[k], box: dragRefs[k].node.getBoundingClientRect() }))
    //     .sort((a, b) => a.box.top - b.box.top);

    const move = (evt) => {
        const current = currentDragger.current;
        if (!current) {
            return;
        }
        const pos = getMainEvtPos(evt);
        if (pos == null) {
            return;
        }
        if (!current.started) {
            const initialPos = current.dragging.pos;
            const dist = Math.sqrt(
                Math.pow(pos.x - initialPos.x, 2) + Math.pow(pos.y - initialPos.y, 2),
            );
            if (dist < 10) {
                return;
            }
        }
        if (current.dest == null) {
            current.dragging.onStart();
        }
        const position = getPosition(dropTargets, pos, limitX, current.dragging);
        if (position) {
            // exclude these already? yeah
            // if (
            //     position.dest &&
            //     (position.dest.id === position.dragging.id ||
            //         position.dest.path.includes(position.dragging.id))
            // ) {
            //     position.dest = null;
            // }
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
        if (dest) {
            onDrop(dragging, dest);
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
