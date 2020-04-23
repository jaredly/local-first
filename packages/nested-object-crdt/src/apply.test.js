// @-flow

import * as crdt from './new';

const schema = {
    type: 'object',
    attributes: {
        children: 'id-array',
        // ages: { type: 'array', value: 'number' },
    },
};

const noop = () => {
    throw new Error('no other');
};

describe('Insert', () => {
    it('should allow insert/remove/insert', () => {
        let data = crdt.createWithSchema(
            {
                children: ['a', 'b', 'c'],
                // ages: [2, 3, 4],
            },
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
});
