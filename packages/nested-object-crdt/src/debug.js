// @flow
import type { CRDT } from './types';
import deepEqual from 'fast-deep-equal';
import * as sortedArray from './array-utils';

export const checkConsistency = function<T, Other>(
    crdt: CRDT<T, Other>,
): ?Array<string> {
    if (crdt.meta.type === 'plain') {
        return null;
    }
    if (crdt.meta.type === 't') {
        if (crdt.value != null) {
            throw new Error('expected tombstone value to be null');
        }
        return;
    }
    if (crdt.meta.type === 'other') {
        return;
    }
    if (crdt.meta.type === 'map') {
        if (
            crdt.value == null ||
            Array.isArray(crdt.value) ||
            typeof crdt.value !== 'object'
        ) {
            throw new Error(`Meta is map, but value doesn't match`);
        }
        for (let id in crdt.meta.map) {
            checkConsistency({
                value: crdt.value[id],
                meta: crdt.meta.map[id],
            });
        }
        return;
    }
    if (crdt.meta.type === 'array') {
        if (crdt.value == null || !Array.isArray(crdt.value)) {
            throw new Error(`meta is 'array' but value doesn't match`);
        }
        const { value, meta } = crdt;
        const ids = Object.keys(meta.items)
            .filter(key => meta.items[key].meta.type !== 't')
            .sort((a, b) =>
                sortedArray.compare(
                    meta.items[a].sort.idx,
                    meta.items[b].sort.idx,
                ),
            );
        if (!deepEqual(ids, meta.idsInOrder)) {
            throw new Error(
                `idsInOrder mismatch! ${ids.join(
                    ',',
                )} vs cached ${meta.idsInOrder.join(',')}`,
            );
        }
        if (value.length !== ids.length) {
            throw new Error(
                `Value has a different length than non-tombstone IDs`,
            );
        }
        meta.idsInOrder.forEach((id, i) => {
            checkConsistency({
                value: value[i],
                meta: meta.items[id].meta,
            });
        });
    }
};
