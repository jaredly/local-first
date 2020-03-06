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

// Content
const bold = (value, stamp?) => ({
    type: 'open',
    key: 'bold',
    value,
    ...(stamp ? { stamp } : {}),
});
const ctext = text => ({ type: 'text', text });
const close = stamp => ({ type: 'close', ...(stamp ? { stamp } : {}) });

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
    {
        title: 'Delete at start',
        actions: [insert(0, 'Hello'), del(0, 2), { state: [text('llo')] }],
    },
    {
        title: 'Delete in middle',
        actions: [insert(0, 'Hello'), del(1, 2), { state: [text('Hlo')] }],
    },
    {
        title: 'Delete multiple',
        // only: true,
        actions: [
            insert(0, 'Hello'),
            del(1, 2),
            del(2, 1),
            { state: [text('Hl')] },
        ],
    },
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
                    bold(false, '1'),
                    bold(true, '0'),
                    ctext('a b'),
                    close('1'),
                    ctext(' c d'),
                    close('0'),
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
                    bold(false, '1'),
                    bold(true, '0'),
                    ctext('a '),
                    bold(true, '2'),
                    ctext('b'),
                    close('1'),
                    ctext(' c'),
                    close('2'),
                    ctext(' d'),
                    close('0'),
                    // {type: 'open', key: 'bold', value: false, stamp: '1'},
                    // '>bold(false):1',
                    // '>bold(true):0',
                    // 'text(a )',
                    // '>bold(true):2',
                    // 'text(b)',
                    // '<bold:1',
                    // 'text( c)',
                    // '<bold:2',
                    // 'text( d)',
                    // '<bold:0',
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
        title:
            'Insert with format - connected - should reuse existing format tag',
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
            {
                contents: [
                    ctext('a '),
                    bold(true),
                    ctext('bold'),
                    ctext('b c'),
                    close(),
                    ctext(' d'),
                ],
            },
            // {
            //     contents: ['text(a )', '>bold(true):_', '>'],
            // },
        ],
    },
    {
        title: 'Bullet then insert',
        quillDeltas: [
            { ops: [{ insert: 'Hello\n' }] },
            {
                ops: [
                    { retain: 5 },
                    { retain: 1, attributes: { list: 'bullet' } },
                ],
            },
            {
                ops: [
                    { retain: 5 },
                    { insert: '\n', attributes: { list: 'bullet' } },
                ],
            },
            { ops: [{ retain: 6 }, { insert: 'Y' }] },
            { ops: [{ retain: 7 }, { insert: 'e' }] },
        ],
        quillResult: {
            ops: [
                { insert: 'Hello' },
                { attributes: { list: 'bullet' }, insert: '\n' },
                { insert: 'Ye' },
                { attributes: { list: 'bullet' }, insert: '\n' },
            ],
        },
    },
    {
        title: 'bullet delete then indent',
        // only: true,
        quillDeltas: [
            { ops: [{ insert: 'Hello\n' }] },
            {
                ops: [
                    { retain: 5 },
                    { retain: 1, attributes: { list: 'bullet' } },
                ],
            },
            {
                ops: [
                    { retain: 5 },
                    { insert: '\n', attributes: { list: 'bullet' } },
                ],
            },
            { ops: [{ retain: 6 }, { insert: 'k' }] },
            { ops: [{ retain: 7 }, { insert: '\t' }] },
            { ops: [{ retain: 7 }, { delete: 1 }] },
            { ops: [{ retain: 7 }, { retain: 1, attributes: { indent: 1 } }] },
        ],
        quillResult: {
            ops: [
                { insert: 'Hello' },
                { attributes: { list: 'bullet' }, insert: '\n' },
                { insert: 'k' },
                { attributes: { indent: 1, list: 'bullet' }, insert: '\n' },
            ],
        },
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
