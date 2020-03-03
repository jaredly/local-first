// @flow

const insert = (at, text) => ({ type: 'insert', at, text });
const del = (at, count) => ({ type: 'delete', at, count });
const fmt = (at, count, key, value, stamp = Date.now()) => ({
    type: 'fmt',
    at,
    count,
    key,
    value,
    stamp,
});

const text = (text, fmt = {}) => ({ text, fmt });

module.exports = [
    // Insertions
    [insert(0, 'Hi'), { state: [text('Hi')] }],
    [
        insert(0, 'Hello'),
        insert(1, '1'),
        insert(3, '2'),
        { state: [text('H1e2llo')] },
    ],
    // // Deletions
    // [insert(0, 'Hello'), del(0, 2), { state: [text('llo')] }],
    // [insert(0, 'Hello'), del(1, 2), { state: [text('Hlo')] }],
    // // Insert and delete
    // [
    //     insert(0, 'Hello'),
    //     insert(2, '-i-'),
    //     del(0, 1),
    //     { state: [text('e-i-llo')] },
    // ],
    // // Fmt
    [
        insert(0, 'Hello'),
        fmt(1, 2, 'bold', true),
        { state: [text('H'), text('el', { bold: true }), text('lo')] },
    ],
    [
        insert(0, 'a b c d'),
        fmt(0, 7, 'bold', true, '0'),
        fmt(0, 3, 'bold', false, '1'),
        {
            contents: [
                '>bold(false):1',
                '>bold(true):0',
                'text(a b)',
                '<bold:1',
                'text( c d)',
                '<bold:0',
            ],
        },
        {
            state: [text('a b', { bold: false }), text(' c d', { bold: true })],
        },
    ],
    [
        insert(0, 'a b c d'),
        {
            parallel: {
                a: [
                    fmt(0, 7, 'bold', true, '0'),
                    fmt(0, 3, 'bold', false, '1'),
                ],
                b: [fmt(2, 3, 'bold', true, '2')],
            },
        },
        {
            contents: [
                '>bold(false):1',
                '>bold(true):0',
                'text(a )',
                '>bold(true):2',
                'text(b)',
                '<bold:1',
                'text( c)',
                '<bold:2',
                'text( d)',
                '<bold:0',
            ],
        },
        {
            state: [text('a ', { bold: false }), text('b c d', { bold: true })],
        },
    ],
    // different order
    [
        insert(0, 'a b c d'),
        {
            parallel: {
                a: [
                    fmt(0, 7, 'bold', true, '0'),
                    fmt(0, 3, 'bold', false, '2'),
                ],
                b: [fmt(2, 3, 'bold', true, '1')],
            },
        },
        {
            state: [text('a b', { bold: false }), text(' c d', { bold: true })],
        },
    ],
];
