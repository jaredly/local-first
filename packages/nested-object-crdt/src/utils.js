// @flow
import type { Meta, CRDT } from './types';

const latestMetaStamp = function<Other>(
    meta: Meta<Other>,
    otherStamp: Other => ?string,
): ?string {
    if (meta.type === 'map') {
        let max = meta.hlcStamp;
        Object.keys(meta.map).forEach(id => {
            const stamp = latestMetaStamp(meta.map[id], otherStamp);
            if (stamp && (!max || stamp > max)) {
                max = stamp;
            }
        });
        return max;
    } else if (meta.type === 'plain' || meta.type === 't') {
        return meta.hlcStamp;
    } else if (meta.type === 'array') {
        let max = meta.hlcStamp;
        Object.keys(meta.items).forEach(id => {
            const stamp = latestMetaStamp(meta.items[id].meta, otherStamp);
            if (stamp && (!max || stamp > max)) {
                max = stamp;
            }
        });
        return max;
    } else {
        const max = meta.hlcStamp;
        const inner = otherStamp(meta.meta);
        return inner && inner > max ? inner : max;
    }
};

export const latestStamp = function<T, Other>(
    data: CRDT<T, Other>,
    otherStamp: Other => ?string,
): string {
    const latest = latestMetaStamp(data.meta, otherStamp);
    return latest ?? '';
};
