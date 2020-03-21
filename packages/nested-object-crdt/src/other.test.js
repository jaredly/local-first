// @-flow

import * as crdt from './new';

// Here we have an increment-only counter as the "other"

const mergeOther = (v1, m1, v2, m2) => {
    return { value: Math.max(v1, v2), meta: null };
};

const applyOtherDelta = function<T, Other>(v: T, meta: Other, delta) {
    if (typeof v !== 'number') {
        throw new Error('increment-only counter must be a number');
    }
    return { value: Math.max(v, delta), meta };
};

let counter = 0;
const getStamp = () => {
    counter += 1;
    return counter.toString(36).padStart(5, '0');
};

describe('other crdt handling', () => {
    it('other delta in array', () => {
        const base = crdt.createDeep([3], '1', getStamp);
        // $FlowFixMe
        base.meta.items[base.meta.idsInOrder[0]].meta = {
            type: 'other',
            meta: null,
            hlcStamp: '1',
        };
        const one = crdt.applyDelta(
            base,
            crdt.deltas.other(base, [0], 1),
            applyOtherDelta,
            mergeOther,
        );
        expect(one.value[0]).toEqual(3);
        const two = crdt.applyDelta(
            one,
            crdt.deltas.other(one, [0], 5),
            applyOtherDelta,
            mergeOther,
        );
        expect(two.value[0]).toEqual(5);
    });
    it('other delta', () => {
        let base: crdt.CRDT<
            { one: number, two: number, three?: number },
            null,
        > = crdt.createDeep({ one: 1, two: 2 }, '1', getStamp);
        base = crdt.applyDelta(
            base,
            // $FlowFixMe
            crdt.deltas.set(base, ['three'], crdt.createOther(3, null, '1')),
            applyOtherDelta,
            mergeOther,
        );
        const one = crdt.applyDelta(
            base,
            crdt.deltas.other(base, ['three'], 4),
            applyOtherDelta,
            mergeOther,
        );
        const two = crdt.applyDelta(
            base,
            crdt.deltas.other(base, ['three'], 5),
            applyOtherDelta,
            mergeOther,
        );
        const three = crdt.applyDelta(
            base,
            crdt.deltas.other(base, ['three'], 1),
            applyOtherDelta,
            mergeOther,
        );
        const final = crdt.mergeTwo(
            // $FlowFixMe
            crdt.mergeTwo(one, two, mergeOther),
            three,
            mergeOther,
        );
        // $FlowFixMe
        expect(final.value.three).toEqual(5);
    });
    it('other merge', () => {
        const base: crdt.CRDT<
            { one: number, two: number, three?: number },
            null,
        > = crdt.createDeep({ one: 1, two: 2 }, '1', getStamp);
        const one = crdt.applyDelta(
            base,
            // $FlowFixMe
            crdt.deltas.set(base, ['three'], crdt.createOther(3, null, '1')),
            applyOtherDelta,
            mergeOther,
        );
        const two = crdt.applyDelta(
            base,
            // $FlowFixMe
            crdt.deltas.set(base, ['three'], crdt.createOther(4, null, '1')),
            applyOtherDelta,
            mergeOther,
        );
        const three = crdt.applyDelta(
            base,
            // $FlowFixMe
            crdt.deltas.set(base, ['three'], crdt.createOther(1, null, '1')),
            applyOtherDelta,
            mergeOther,
        );
        const final = crdt.mergeTwo(
            // $FlowFixMe
            crdt.mergeTwo(one, two, mergeOther),
            three,
            mergeOther,
        );
        // $FlowFixMe
        expect(final.value.three).toEqual(4);
    });
    it('other delta', () => {});
});
