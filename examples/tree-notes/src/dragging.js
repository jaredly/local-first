// @flow

export type DropTarget<T> = {
    parent: Element,
    top: number,
    height: number,
    left: number,
    width: number,
    dest: T,

    // top: number,
    // height: number,
    // // y: number,
    // left: number,
    // width: number,
    // offsetParent: ?Element,
    // contents: T,
};

export type DragInit = {
    // id: string,
    // type?: string,
    path: Array<string>,
    // onStart: () => void,
    // onFinish: () => void,
    pos: { x: number, y: number },
};

export type DragState<Dest> = {
    started: boolean,
    dragging: DragInit,
    dest: ?Dest,
    dims: ?{
        // y: number,
        top: number,
        height: number,
        left: number,
        width: number,
    },
    targets: Array<DropTarget<Dest>>,
};

export type OnDragRef = (
    id: string,
    val: ?{
        path: Array<string>,
        node: Element,
        idx: number,
        parent: boolean,
    },
) => void;

const inside = (x, box) => box.left <= x && x <= box.left + box.width;

const getPosition = function <Dest>(
    boxes: Array<DropTarget<Dest>>,
    pos: { x: number, y: number },
    limitX: boolean,
    dragging,
): ?DragState<Dest> {
    const offsetParent = boxes[0].parent;
    const offset = offsetParent ? offsetParent.getBoundingClientRect().top : 0;
    const matchingBoxes = limitX ? boxes.filter((box) => inside(pos.x, box)) : boxes;
    for (let i = 0; i < matchingBoxes.length; i++) {
        // if we're closer to the current than the next one, go with it
        const d0 = Math.abs(pos.y - (matchingBoxes[i].top + matchingBoxes[i].height / 2));
        const dNext =
            i < matchingBoxes.length - 2
                ? limitX && !inside(pos.x, matchingBoxes[i])
                    ? Infinity
                    : Math.abs(pos.y - (matchingBoxes[i + 1].top + matchingBoxes[i + 1].height / 2))
                : Infinity;
        if (d0 < dNext) {
            return {
                started: true,
                dragging,
                dest: matchingBoxes[i].dest,
                dims: {
                    top: matchingBoxes[i].top - offset,
                    height: matchingBoxes[i].height,
                    left: matchingBoxes[i].left,
                    width: matchingBoxes[i].width,
                },
                targets: boxes,
            };
        }
    }
    return null;
};

const getMainEvtPos = (evt) =>
    evt.clientY == null
        ? evt.touches.length > 0
            ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
            : null
        : { x: evt.clientX, y: evt.clientY };

export const setupDragListeners = function <Dest: {}>(
    dropTargets: Array<DropTarget<Dest>>,
    currentDragger: { current: ?DragState<Dest> },
    limitX: boolean,
    setDragger: (?DragState<Dest>) => void,
    onDrop: (DragInit, Dest) => void,
) {
    const positions = {};

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
            // STOPSHIP
            // current.dragging.onStart();
        }
        const position = getPosition(dropTargets, pos, limitX, current.dragging);
        if (position) {
            setDragger(position);
        }
    };
    const up = (evt) => {
        const dragger = currentDragger.current;
        if (!dragger) {
            return;
        }
        const { dragging, dest } = dragger;
        if (dest) {
            onDrop(dragging, dest);
        }
        // STOPSHIP
        // dragging.onFinish();
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
