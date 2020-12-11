// @flow

import type { Node, CRDT } from './types';
import { contentChars, toKey } from './utils';
import { walk, fmtIdx } from './loc';
import deepEqual from 'fast-deep-equal';

const checkSize = (state, id) => {
    const node = state.map[id];
    let size = node.deleted ? 0 : contentChars(node.content);
    node.children.forEach(child => {
        checkSize(state, child);
        size += state.map[child].size;
    });
    if (size !== node.size) {
        console.log(size, node.size, node);
        throw new Error(`Wrong cached size ${node.size} - should be ${size}; for ${id}`);
    }
};

export const checkConsistency = (state: CRDT) => {
    state.roots.forEach(id => checkSize(state, id));
    checkFormats(state);
};

export const checkFormats = (state: CRDT) => {
    const format = {};
    walk(state, node => {
        if (node.content.type === 'open') {
            const content = node.content;
            if (!format[content.key]) {
                format[content.key] = [toKey(node.id)];
            } else {
                const idx = fmtIdx(
                    format[content.key].map(id => state.map[id].content),
                    content,
                );
                // insert into sorted order.
                format[content.key].splice(idx, 0, toKey(node.id));
            }
        } else if (node.content.type === 'close') {
            const content = node.content;
            const f = format[content.key];
            if (!f) {
                console.log(
                    'Found a "close" marker, but no open marker.',
                    content.key,
                    format,
                    content,
                );
                return;
            }
            const idx = f.findIndex(
                item =>
                    state.map[item].content.type !== 'text' &&
                    state.map[item].content.stamp === content.stamp,
            );
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (!f.length) {
                delete format[content.key];
            }
        }
        if (!deepEqual(format, node.formats)) {
            throw new Error(
                `Formats mismatch for ${toKey(node.id)}: expected: ${JSON.stringify(
                    format,
                )}; actual: ${JSON.stringify(node.formats)}`,
            );
        }
    });
};
