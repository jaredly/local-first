// @flow

import type { DragInit, DropTarget } from '../TodoList/dragging';

export type Dest =
    | {
          type: 'topone',
      }
    | {
          type: 'toptwo',
      }
    | {
          type: 'other',
          index: number,
      }
    | {
          type: 'hourly',
          time: number, // units = hours, step = 0.25 probably? or 0.5
      };

export type DragRefs = {
    hourly: ?HTMLDivElement,
    others: {
        [key: string]: {
            id: string,
            node: HTMLDivElement,
            idx: number,
        },
    },
    topOne: ?HTMLDivElement,
    topTwo: ?HTMLDivElement,
};

export const calculateDragTargets = (
    refs: DragRefs,
    current: DragInit,
): Array<DropTarget<Dest>> => {
    const boxes: Array<DropTarget<Dest>> = [];
    if (refs.topOne && current.id !== ':one:') {
        const topOne = refs.topOne;
        const box = topOne.getBoundingClientRect();
        boxes.push({
            top: box.top,
            height: box.height,
            // y: box.top + box.height / 2,
            left: box.left,
            width: box.width,
            offsetParent: topOne.offsetParent,
            contents: {
                id: ':one:',
                type: 'topone',
            },
        });
    }

    if (refs.topTwo && current.id !== ':two:') {
        const topTwo = refs.topTwo;
        const box = topTwo.getBoundingClientRect();
        boxes.push({
            // y: box.top + box.height / 2,
            top: box.top,
            height: box.height,
            left: box.left,
            width: box.width,
            offsetParent: topTwo.offsetParent,
            contents: {
                id: ':two:',
                type: 'topone',
            },
        });
    }

    Object.keys(refs.others).forEach((key) => {
        const box = refs.others[key].node.getBoundingClientRect();
        boxes.push({
            // y: box.top,
            top: box.top,
            height: 0,
            left: box.left,
            width: box.width,
            offsetParent: refs.others[key].node.offsetParent,
            contents: {
                type: 'other',
                index: refs.others[key].idx,
            },
        });

        boxes.push({
            top: box.bottom,
            height: 0,
            left: box.left,
            width: box.width,
            offsetParent: refs.others[key].node.offsetParent,
            contents: {
                type: 'other',
                index: refs.others[key].idx + 1,
            },
        });
    });

    if (refs.hourly) {
        const offsetParent = refs.hourly.offsetParent;
        const hourBox = refs.hourly.getBoundingClientRect();
        const minHour = 3;
        const maxHour = 22;
        const steps = maxHour - minHour;
        for (let i = minHour; i <= maxHour; i += 0.5) {
            const amt = (i - minHour) / (maxHour - minHour);
            boxes.push({
                offsetParent: offsetParent,
                top: hourBox.top + hourBox.height * amt,
                height: hourBox.height / steps / 2,
                left: hourBox.left,
                width: hourBox.width,
                contents: { type: 'hourly', time: i },
            });
        }
    }

    return boxes;
};
