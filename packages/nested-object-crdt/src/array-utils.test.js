// @-flow

import {
    sortForInsertion,
    // insertionIndex,
    compare,
    between,
} from './array-utils';

describe('between', () => {
    it('should compare', () => {
        expect(compare([0], [0, 0])).toBeLessThan(0);
    });
    it('should stand up to lots of inserts next to each other', () => {
        const items = [];
        const left = between(null, null);
        items.push(left);
        let right = between(left, null);
        items.push(right);
        for (let i = 0; i < 1000; i++) {
            const newRight = between(left, right);
            expect(compare(left, newRight)).toBeLessThan(0);
            expect(compare(newRight, right)).toBeLessThan(0);
            right = newRight;
            items.splice(1, 0, right);
        }
    });
    it('should stand up to a bunch of random inserts', () => {
        const items = [];
        let left = null;
        for (let i = 0; i < 100; i++) {
            const next = between(left, null);
            items.push(next);
            left = next;
        }
        for (let i = 0; i < 10000; i++) {
            const idx = parseInt(Math.random() * (items.length + 1));
            const next = between(items[idx - 1], items[idx]);
            items.splice(idx, 0, next);
        }
        for (let i = 0; i < items.length - 1; i++) {
            expect(compare(items[i], items[i + 1])).toBeLessThan(0);
        }
    });
});
