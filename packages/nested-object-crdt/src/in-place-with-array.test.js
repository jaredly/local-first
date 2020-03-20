// @-flow

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

// console.log(JSON.stringify(base));

describe('tombstones', () => {
    it('should shorten an array', () => {
        const changed = apply(
            base,
            crdt.deltas.removeAt(base, ['instructions', 1], '2'),
        );
        console.log(JSON.stringify([changed, base]));
        expect(changed.value.instructions).toEqual([
            { text: 'go left' },
            { stop: true },
        ]);
        crdt.checkConsistency(changed);
    });
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
        crdt.checkConsistency(changed);
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
        crdt.checkConsistency(changed);
    });
    it('should reorder an array', () => {
        const changed = apply(
            base,
            crdt.deltas.reorder(base, ['instructions'], 0, 1, '2'),
        );
        expect(changed.value.instructions).toEqual([
            { text: 'go right' },
            { text: 'go left' },
            { stop: true },
        ]);
        crdt.checkConsistency(changed);
    });
});
