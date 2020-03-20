// @flow

import * as crdt from './in-place-with-array';
// import * as hlc from '../../hybrid-logical-clock';

const baseData = {
    person: {
        name: 'local',
        age: 2,
    },
    instructions: [{ text: 'go left' }, { text: 'go right' }, { stop: true }],
};
const base = crdt.createDeep(baseData, '1');

const apply = (base, delta) =>
    crdt.applyDelta(base, delta, (_, __, ___) => {
        throw new Error('no other');
    });

describe('it', () => {
    it('should do something', () => {
        const changed = apply(
            base,
            crdt.deltas.set(
                base,
                ['person', 'name'],
                crdt.create('Awesome', '2'),
            ),
        );
        expect(changed.value.person.name).toEqual('Awesome');
    });
    it('should set inside an array', () => {
        const changed = apply(
            base,
            crdt.deltas.set(
                base,
                ['instructions', 1, 'text'],
                crdt.create('go back', '2'),
            ),
        );
        expect(changed.value.instructions[1].text).toEqual('go back');
    });
});
