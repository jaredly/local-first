// @-flow

import * as crdt from './in-place-with-array';
// import * as hlc from '../../hybrid-logical-clock';

const baseData = {
    person: {
        name: 'local',
        age: 2,
    },
    colors: ['red', 'green', 'blue'],
    instructions: [{ text: 'go left' }, { text: 'go right' }, { stop: true }],
};
const base = crdt.createDeep(baseData, '1');

const apply = (base, delta) => {
    const res = crdt.applyDelta(base, delta, (_, __, ___) => {
        throw new Error('no other');
    });
    crdt.checkConsistency(res);
    return res;
};

describe('tombstones', () => {
    it('should shorten an array', () => {
        const changed = apply(
            base,
            crdt.deltas.removeAt(base, ['instructions', 1], '2'),
        );
        expect(changed.value.instructions).toEqual([
            { text: 'go left' },
            { stop: true },
        ]);
        crdt.checkConsistency(changed);
    });
    it('should shorten an array, and then restore it', () => {
        const a = apply(
            base,
            crdt.deltas.removeAt(base, ['instructions', 1], '2'),
        );
        const delta = crdt.deltas.set(
            base,
            ['instructions', 1],
            crdt.createDeep({ text: 'oooh' }, '3'),
        );
        const b = apply(a, delta);
        expect(b.value.instructions).toEqual([
            { text: 'go left' },
            { text: 'oooh' },
            { stop: true },
        ]);
        crdt.checkConsistency(b);
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
    it('should add and remove an object attribute', () => {
        const delta = crdt.deltas.set(
            base,
            ['person', 'color'],
            crdt.create('green', '2'),
        );
        const a = apply(base, delta);
        expect(a.value.person).toEqual({
            name: 'local',
            age: 2,
            color: 'green',
        });
        const b = apply(a, crdt.deltas.removeAt(a, ['person', 'color'], '3'));
        expect(b.value.person).toEqual({ name: 'local', age: 2 });
    });
    it('should handle insert', () => {
        const a = apply(
            base,
            crdt.deltas.insert(
                base,
                ['instructions'],
                1,
                crdt.createDeep({ text: 'more things' }, '2'),
                '2',
            ),
        );
        expect(a.value.instructions).toEqual([
            { text: 'go left' },
            { text: 'more things' },
            { text: 'go right' },
            { stop: true },
        ]);
    });
    it('set older', () => {
        const a = apply(
            base,
            crdt.deltas.set(
                base,
                ['person'],
                crdt.createDeep({ name: 'ok', age: 5 }, ''),
            ),
        );
        expect(a.value).toEqual(base.value);
    });
    it('merge', () => {
        const person = crdt.get(base, ['person']);
        const newPerson = apply(
            person,
            crdt.deltas.set(person, ['name'], crdt.create('Yes', '2')),
        );
        const a = apply(base, crdt.deltas.set(base, ['person'], newPerson));
        expect(a.value.person).toEqual({ name: 'Yes', age: 2 });
        expect(crdt.latestStamp(a)).toEqual('2');
    });
    it('should handle insert to start & end', () => {
        const a = apply(
            base,
            crdt.deltas.insert(
                base,
                ['colors'],
                0,
                crdt.create('orange', '2'),
                '2',
            ),
        );
        expect(a.value.colors).toEqual(['orange', 'red', 'green', 'blue']);
        const b = apply(
            a,
            crdt.deltas.insert(
                a,
                ['colors'],
                a.value.colors.length,
                crdt.create('yellow', '3'),
                '3',
            ),
        );
        expect(b.value.colors).toEqual([
            'orange',
            'red',
            'green',
            'blue',
            'yellow',
        ]);
    });
});
