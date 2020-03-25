// @flow

import { selectionToSpans } from './span';
import { insert } from './deltas';
import { apply } from './apply';
import { init } from './';
import type { InsertDelta } from './types';

describe('selectionToSpans', () => {
    it('should work', () => {
        let state = init();
        const d1 = insert(state, 'a', 0, 'abde');
        const d1id = ((d1[0]: any): InsertDelta).id[0];
        state = apply(state, d1);
        const d2 = insert(state, 'a', 2, 'c');
        const d2id = ((d2[0]: any): InsertDelta).id[0];
        state = apply(state, d2);
        expect(selectionToSpans(state, 1, 4)).toEqual([
            { site: 'a', id: d1id + 1, length: 1 },
            { site: 'a', id: d2id, length: 1 },
            { site: 'a', id: d1id + 2, length: 1 },
        ]);
    });
});
