// import * as ncrdt from '../nested-object-crdt';
import { init, localInsert, localDelete, localFormat } from './tree';
import { apply } from './update';
import { length, toString } from './utils';
import * as loc from './loc';
import { selectionToSpans, spansToSelections } from './span';
import { mergeFormats, type Format } from './test-format';
import { deltaToChange, changeToDelta, initialDelta } from './quill-deltas';

const noop = a => a;

const rapply = (state, delta) => {
    apply(state, delta, mergeFormats);
    return delta;
};

const insert = (state, pos, text) =>
    rapply(state, localInsert(state, pos, text));
const del = (state, pos, count) =>
    rapply(state, localDelete(state, pos, count));

describe('quill-deltas', () => {
    it('should worl', () => {
        const a = init('a');
        apply(a, initialDelta, mergeFormats);
        const b = init('b');
        apply(b, initialDelta, mergeFormats);

        const ad = insert(a, 0, 'Hello world.');
        const bd = insert(b, 0, 'Whats up?');

        expect(changeToDelta(b, ad, noop)).toEqual([
            { retain: 'Whats up?'.length },
            { insert: 'Hello world.' },
        ]);
        expect(changeToDelta(a, bd, noop)).toEqual([{ insert: 'Whats up?' }]);
    });
});
