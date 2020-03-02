// @flow

const insert = (at, text) => ({ type: 'insert', at, text });
const del = (at, count) => ({ type: 'delete', at, count });
const fmt = (at, count, key, value) => ({ type: 'fmt', at, count, key, value });

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
    // [
    //     insert(0, 'Hello'),
    //     fmt(1, 2, 'bold', true),
    //     { state: [text('H'), text('el', { bold: true }), text('lo')] },
    // ],
];
