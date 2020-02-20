// @flow

const crdt = require('.');

const spans = (left, id, text) => {
    return text.split('').map((c, i) => ({
        id: [id[0] + i, id[1]],
        left: i === 0 ? left : [id[0] + i - 1, id[1]],
        text: c,
    }));
};

const fixtures = [
    {
        name: 'singles',
        base: { items: [{ id: [0, 'a'], left: [0, 'root'], text: '1' }] },
        deltas: [
            {
                type: 'insert',
                span: { id: [1, 'a'], left: [0, 'a'], text: '0' },
            },
        ],
    },
    {
        name: 'basic',
        base: {
            items: spans([0, 'root'], [0, 'a'], 'hello ').concat(
                spans([5, 'a'], [0, 'b'], 'world'),
            ),
        },
        deltas: [
            {
                type: 'insert',
                span: { id: [5, 'b'], left: [2, 'a'], text: 'd' },
            },
        ],
    },
    {
        name: 'long',
        base: {
            items: [{ id: [0, 'a'], left: [0, 'root'], text: 'hello' }],
            // items: spans([0, 'root'], [0, 'a'], 'hello'),
        },
        deltas: [
            {
                type: 'insert',
                span: { id: [5, 'b'], left: [2, 'a'], text: '_o_' },
            },
        ],
    },
    {
        name: 'fight 1',
        base: {
            items: [
                { id: [0, 'a'], left: [0, 'root'], text: '1' },
                { id: [1, 'a'], left: [0, 'a'], text: '2' },
                { id: [2, 'a'], left: [1, 'a'], text: '3' },
            ],
        },
        deltas: [
            {
                type: 'insert',
                span: { id: [2, 'b'], left: [0, 'a'], text: 'a' },
            },
        ],
    },
    {
        name: 'fight 1',
        base: {
            items: [
                { id: [0, 'a'], left: [0, 'root'], text: '1' },
                { id: [1, 'a'], left: [0, 'a'], text: '2' },
                { id: [2, 'a'], left: [1, 'a'], text: '3' },
            ],
        },
        deltas: [
            {
                type: 'insert',
                span: { id: [0, 'b'], left: [0, 'a'], text: 'a' },
            },
        ],
    },
    //     'basic': [
    //         // [
    //         //     {id: [0, 'a'], left: [0, 'root'], text: 'h'}
    //         // ]
    //         // [span(0, 'a', 'h'), span(1, 'a', 'e'), span(2, 'a', 'l')],
    //         // [span(0, 'a', 'h'), span(1, 'a', 'e'), span(2, 'a', 'l')],
    //     ]
];

fixtures.forEach((fixture, i) => {
    console.log('fixture #', i);
    console.log(crdt.toString(fixture.base));
    fixture.deltas.forEach(delta => {
        crdt.applyDelta(fixture.base, delta, (a, b) => a);
        console.log(delta);
        console.log(fixture.base);
        console.log('After: ', crdt.toString(fixture.base));
    });
});
