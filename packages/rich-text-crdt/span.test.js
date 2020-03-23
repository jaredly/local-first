// @flow

import { selectionToSpans } from './span';
import { insert } from './deltas';
import { apply } from './apply';
import { init } from './';

describe('selectionToSpans', () => {
    it('should work', () => {
        let state = init();
        const d1 = insert(state, 'a', 0, 'abde');
        state = apply(state, d1);
        const d2 = insert(state, 'a', 2, 'c');
        state = apply(state, d2);
        expect(selectionToSpans(state, 1, 4)).toEqual([
            { site: 'a', id: d1[0].id[0] + 1, length: 1 },
            { site: 'a', id: d2[0].id[0], length: 1 },
            { site: 'a', id: d1[0].id[0] + 2, length: 1 },
        ]);
    });
});
