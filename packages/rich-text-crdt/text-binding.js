// @flow

/**
 * Functions to facilitate binding to an <input> or <textarea>
 */

import deepEqual from 'fast-deep-equal';
import type { CRDT, Node, Delta, Span } from './types';
import { insert, del, format } from './deltas';
import { walkWithFmt } from './debug';
import { apply } from './apply';
import { spansToSelections } from './span';
import { locToPos, locToInsertionPos, formatAt, rootSite } from './loc';
import { toKey, keyEq } from './utils';

const getSharedTail = (oldText, newText, selectionPos) => {
    const len = newText.length - selectionPos;
    if (len === 0) {
        return len;
    }
    if (oldText.slice(oldText.length - len) === newText.slice(selectionPos)) {
        return len;
    }
    return null;
};

const getShared = (oldText, newText, selectionPos) => {
    let tail = selectionPos
        ? getSharedTail(oldText, newText, selectionPos)
        : null;
    let head = 0;
    let offset = tail == null ? 0 : tail;
    const maxHead =
        tail == null
            ? Math.min(oldText.length, newText.length)
            : Math.min(oldText.length - tail, newText.length - tail);
    while (oldText.charAt(head) === newText.charAt(head) && head < maxHead) {
        head += 1;
    }
    if (tail != null) {
        return [head, tail];
    }
    tail = 0;
    const maxTail = Math.min(oldText.length - head, newText.length - head);
    while (
        oldText.charAt(oldText.length - 1 - tail) ===
            newText.charAt(newText.length - 1 - tail) &&
        tail < maxTail
    ) {
        tail += 1;
    }
    return [head, tail];
};

export const inferChange = (
    oldText: string,
    newText: string,
    selectionPos: ?number,
) => {
    const [head, tail] = getShared(oldText, newText, selectionPos);
    return {
        removed:
            oldText.length !== head + tail
                ? { at: head, len: oldText.length - head - tail }
                : null,
        added:
            newText.length !== head + tail
                ? { at: head, text: newText.slice(head, newText.length - tail) }
                : null,
    };
};

// export const onInput = (
//     state: CRDT,
//     oldText: string,
//     newText: string,
//     oldSelection:
// )
