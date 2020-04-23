// @-flow

import * as crdt from './new';

const schema = {
    type: 'object',
    attributes: { children: 'id-array' },
};

const noop = () => {
    throw new Error('no other');
};

describe('Insert', () => {
    it('should allow insert/remove/insert', () => {
        let data = crdt.createWithSchema(
            { children: ['a', 'b', 'c'] },
            'a-stamp',
            () => 'a-stamp',
            schema,
            noop,
        );
        const delta = crdt.deltas.insert(
            data,
            ['children'],
            1,
            'd',
            crdt.create('d', 'd-stamp'),
            'd-stamp',
        );

        data = crdt.applyDelta(data, delta, noop);
        expect(data.value.children).toEqual(['a', 'd', 'b', 'c']);
        data = crdt.applyDelta(data, crdt.deltas.removeAt(data, ['children', 'b'], 'e-stamp'));
        expect(data.value.children).toEqual(['a', 'd', 'c']);
        const delta2 = crdt.deltas.insert(
            data,
            ['children'],
            1,
            'b',
            crdt.create('b', 'f-stamp'),
            'f-stamp',
        );
        data = crdt.applyDelta(data, delta2, noop);
        expect(data.value.children).toEqual(['a', 'b', 'd', 'c']);
    });

    it('re-insert in a new place', () => {
        let data = crdt.createWithSchema(
            { children: ['a', 'b', 'c', 'd'] },
            '1-stamp',
            () => '1-stamp',
            schema,
            noop,
        );
        const delta1 = crdt.deltas.insert(
            data,
            ['children'],
            1,
            'e',
            crdt.create('e', '2-stamp'),
            '2-stamp',
        );
        const delta2 = crdt.deltas.insert(
            data,
            ['children'],
            3,
            'e',
            crdt.create('e', '3-stamp'),
            '3-stamp',
        );
        data = crdt.applyDelta(data, delta1, noop);
        data = crdt.applyDelta(data, delta2, noop);
        expect(data.value.children).toEqual(['a', 'b', 'c', 'e', 'd']);
    });
});
