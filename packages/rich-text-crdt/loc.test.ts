import { posToLoc, rootSite, adjustSelection } from './loc';
import { apply, init, insert, del, toString } from './';

describe('posToLoc', () => {
    it('should worlk for left on empty', () => {
        expect(posToLoc(init(), 0, true)).toEqual({
            id: 0,
            site: rootSite,
            pre: true,
        });
    });

    it('should worlk for left', () => {
        let state = init();
        const deltas = insert(state, 'a', 0, 'Hello');
        deltas.forEach(delta => {
            state = apply(state, delta);
        });
        expect(posToLoc(state, 0, true)).toEqual({
            id: 0,
            site: rootSite,
            pre: true,
        });
    });

    it('should do another one', () => {
        let state = init();
        const deltas = insert(state, 'a', 0, 'Hello');
        deltas.forEach(delta => {
            state = apply(state, delta);
        });
        expect(posToLoc(state, 1, true)).toEqual({
            id: deltas[0].id[0],
            site: deltas[0].id[1],
            pre: true,
        });
    });

    it('should properly place selections', () => {
        let state = init();
        state = apply(state, insert(state, 'a', 0, 'one two three'));
        state = apply(state, insert(state, 'a', 4, 'four '));
        let current = apply(state, del(state, 9, 1));
        current = apply(current, del(current, 8, 1));
        current = apply(current, del(current, 7, 1));
        expect(toString(state)).toEqual('one four two three');
        expect(toString(current)).toEqual('one fouwo three');
        // console.log(JSON.stringify([state, current]));
        expect(adjustSelection(state, current, 4, 8)).toEqual({
            start: 4,
            end: 7,
        });

        // one two three
        // one four two three
        // select four
        // start deleting from t of two
    });
});
