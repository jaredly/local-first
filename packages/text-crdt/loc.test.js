import { init, localInsert, localDelete, localFormat } from './tree';
import { apply } from './update';
import { length, toString } from './utils';
import * as loc from './loc';
import { selectionToSpans, spansToSelections } from './span';
import { mergeFormats, type Format } from './test-format';

const insert = (state, pos, text) =>
    apply(state, localInsert(state, pos, text), mergeFormats);
const del = (state, pos, count) =>
    apply(state, localDelete(state, pos, count), mergeFormats);

describe('loc', () => {
    it('should worl', () => {
        const state = init('a');
        insert(state, 0, 'Hello world.');
        insert(state, 6, '1 ');
        insert(state, length(state), ' Yes folks');
        expect(toString(state)).toEqual('Hello 1 world. Yes folks');
        del(state, 2, 4);
        expect(toString(state)).toEqual('He1 world. Yes folks');
    });

    it('should insert correctly with deletion', () => {
        const state = init('a');
        insert(state, 0, 'Hello world.');
        del(state, 1, 1);
        insert(state, 2, 'm');
        expect(toString(state)).toEqual('Hlmlo world. Yes folks');
    });

    it('should be bidirectional', () => {
        const state = init('a');
        insert(state, 0, 'Hello world.');
        insert(state, 6, '1 ');
        insert(state, length(state), ' Yes folks');
        del(state, 2, 4);

        for (let i = 0; i < length(state); i++) {
            const pre = loc.locToPos(state, loc.posToLoc(state, i, true));
            expect(pre).toEqual(i);
            const post = loc.locToPos(state, loc.posToLoc(state, i, false));
            expect(post).toEqual(i);
        }
    });

    it('should select correctly', () => {
        const state = init('a');
        insert(state, 0, 'Hello world.');
        insert(state, 6, '1 ');
        insert(state, length(state), ' Yes folks');
        const spans = selectionToSpans(state, 0, 10);
        expect(spans).toEqual([
            { id: 2, site: 'a', length: 6 },
            { id: 14, length: 2, site: 'a' },
            { id: 8, length: 2, site: 'a' },
        ]);
        const back = spansToSelections(state, spans);
        expect(back).toEqual([{ start: 0, end: 10 }]);
    });
});
