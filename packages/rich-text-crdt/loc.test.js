import { posToLoc, rootSite } from './loc';
import { apply, init, insert } from './';

describe('posToLoc', () => {
    it('should worlk for left on empty', () => {
        expect(posToLoc(init('a'), 0, true)).toEqual({
            id: 0,
            site: rootSite,
            pre: true,
        });
    });

    it('should worlk for left', () => {
        let state = init('a');
        const deltas = insert(state, 0, 'Hello');
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
        let state = init('a');
        const deltas = insert(state, 0, 'Hello');
        deltas.forEach(delta => {
            state = apply(state, delta);
        });
        console.log(JSON.stringify(state));
        expect(posToLoc(state, 1, true)).toEqual({
            id: deltas[0].id[0],
            site: deltas[0].id[1],
            pre: true,
        });
    });
});
