// @flow

const insert = (at, text, format = {}) => ({
    type: 'insert',
    at,
    text,
    format,
});
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
    {
        title: 'Basic insertion',
        actions: [insert(0, 'Hi'), { state: [text('Hi')] }],
    },
    {
        title: 'Insert several',
        actions: [
            insert(0, 'Hello'),
            insert(1, '1'),
            insert(3, '2'),
            { state: [text('H1e2llo')] },
        ],
    },
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
    {
        title: 'Basic fmt',
        actions: [
            insert(0, 'Hello'),
            fmt(1, 2, 'bold', true),
            { state: [text('H'), text('el', { bold: true }), text('lo')] },
        ],
    },
    {
        title: 'fmt overwrite',
        actions: [
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
                state: [
                    text('a b', { bold: false }),
                    text(' c d', { bold: true }),
                ],
            },
        ],
    },
    {
        title: 'fmt then insert, chech cache',
        actions: [
            insert(0, 'a bc d'),
            fmt(2, 2, 'bold', true),
            insert(3, 'hi'),
            { state: [text('a '), text('bhic', { bold: true }), text(' d')] },
        ],
    },
    {
        title: 'parallel fmt, stamp precedence',
        actions: [
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
                state: [
                    text('a ', { bold: false }),
                    text('b c d', { bold: true }),
                ],
            },
        ],
    },
    // different order
    {
        title: 'parallel fmt (different stamp order)',
        actions: [
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
                state: [
                    text('a b', { bold: false }),
                    text(' c d', { bold: true }),
                ],
            },
        ],
    },
    {
        title: 'Insert with format',
        actions: [
            insert(0, 'Hello world'),
            insert(5, ' cruel', { bold: true }),
            {
                state: [
                    text('Hello'),
                    text(' cruel', { bold: true }),
                    text(' world'),
                ],
            },
        ],
    },
    {
        title: 'Insert with format - connected',
        actions: [
            insert(0, 'a b c d'),
            fmt(2, 3, 'bold', true),
            insert(2, 'bold', { bold: true }),
            {
                state: [
                    text('a '),
                    text('boldb c', { bold: true }),
                    text(' d'),
                ],
            },
            // {
            //     contents: ['text(a )', '>bold(true):_', '>'],
            // },
        ],
    },
    // Umm. So now what?
    // Maybe I write out the results?
    // Or something?
    // Or how bout I add some ... tests?
    // Or deletion of things?
    // Yeah I definitely need to add deletion.
    // And then ...
    // ... some way to
];
