import type { CRDT, Delta } from './types';
import { apply, init, merge } from './';
import {
    quillDeltasToDeltas,
    stateToQuillContents,
    QuillDelta,
} from './quill-deltas';

type QuillContents = { ops: Array<QuillDelta> };

type Client = {
    site: string;
    state: CRDT;
    outbox: Array<Delta>;
    stamp: number;
};

const cloneState = (state: CRDT): CRDT => JSON.parse(JSON.stringify(state));

const makeClient = (site: string, state: CRDT = init()): Client => ({
    site,
    state: cloneState(state),
    outbox: [],
    stamp: 0,
});

const normalizeContents = (contents: QuillContents): QuillContents => {
    const ops = [];
    contents.ops.forEach(op => {
        if (!op.insert) {
            return;
        }
        const normalized: QuillDelta = { insert: op.insert };
        if (op.attributes) {
            const attributes = {};
            Object.keys(op.attributes).forEach(key => {
                if (op.attributes[key]) {
                    attributes[key] = op.attributes[key];
                }
            });
            if (Object.keys(attributes).length) {
                normalized.attributes = attributes;
            }
        }
        const prev = ops[ops.length - 1];
        if (
            prev &&
            JSON.stringify(prev.attributes || {}) === JSON.stringify(normalized.attributes || {})
        ) {
            prev.insert += normalized.insert;
        } else {
            ops.push(normalized);
        }
    });
    return { ops };
};

const contents = (client: Client): QuillContents =>
    normalizeContents(stateToQuillContents(client.state));

const stateContents = (state: CRDT): QuillContents =>
    normalizeContents(stateToQuillContents(state));

const expectContents = (client: Client, expected: QuillContents) => {
    expect(contents(client)).toEqual(normalizeContents(expected));
};

const expectStateContents = (state: CRDT, expected: QuillContents) => {
    expect(stateContents(state)).toEqual(normalizeContents(expected));
};

const applyQuill = (client: Client, ops: Array<QuillDelta>): Array<Delta> => {
    const result = quillDeltasToDeltas(client.state, client.site, ops, () => {
        const stamp = `${client.site}:${client.stamp.toString(36).padStart(4, '0')}`;
        client.stamp += 1;
        return stamp;
    });
    client.state = result.state;
    client.outbox.push(...result.deltas);
    return result.deltas;
};

const applyQuillSteps = (client: Client, steps: Array<Array<QuillDelta>>) => {
    steps.forEach(step => applyQuill(client, step));
};

const deliver = (target: Client, deltas: Array<Delta>) => {
    deltas.forEach(delta => {
        target.state = apply(target.state, delta);
    });
};

const forkAfter = (steps: Array<Array<QuillDelta>>): CRDT => {
    const base = makeClient('base');
    applyQuillSteps(base, steps);
    return base.state;
};

const runConcurrent = ({
    initial = [],
    a,
    b,
    expected,
}: {
    initial?: Array<Array<QuillDelta>>;
    a: Array<Array<QuillDelta>>;
    b: Array<Array<QuillDelta>>;
    expected: QuillContents;
}) => {
    const base = forkAfter(initial);

    const aFirst = makeClient('a', base);
    const bSecond = makeClient('b', base);
    applyQuillSteps(aFirst, a);
    applyQuillSteps(bSecond, b);
    deliver(aFirst, bSecond.outbox);
    deliver(bSecond, aFirst.outbox);
    deliver(aFirst, bSecond.outbox);
    deliver(bSecond, aFirst.outbox);
    expectContents(aFirst, expected);
    expectContents(bSecond, expected);

    const bFirst = makeClient('b', base);
    const aSecond = makeClient('a', base);
    applyQuillSteps(bFirst, b);
    applyQuillSteps(aSecond, a);
    deliver(bFirst, aSecond.outbox);
    deliver(aSecond, bFirst.outbox);
    deliver(bFirst, aSecond.outbox);
    deliver(aSecond, bFirst.outbox);
    expectContents(bFirst, expected);
    expectContents(aSecond, expected);
};

const runThreeConcurrent = ({
    initial = [],
    a,
    b,
    c,
    expected,
}: {
    initial?: Array<Array<QuillDelta>>;
    a: Array<Array<QuillDelta>>;
    b: Array<Array<QuillDelta>>;
    c: Array<Array<QuillDelta>>;
    expected: QuillContents;
}) => {
    const base = forkAfter(initial);
    const clients = [
        { site: 'a', steps: a },
        { site: 'b', steps: b },
        { site: 'c', steps: c },
    ];
    const orders = [
        ['a', 'b', 'c'],
        ['c', 'b', 'a'],
        ['b', 'a', 'c'],
    ];

    orders.forEach(order => {
        const bySite = {};
        clients.forEach(({ site, steps }) => {
            bySite[site] = makeClient(site, base);
            applyQuillSteps(bySite[site], steps);
        });

        order.forEach(fromSite => {
            order.forEach(toSite => {
                if (fromSite !== toSite) {
                    deliver(bySite[toSite], bySite[fromSite].outbox);
                }
            });
        });

        clients.forEach(({ site }) => {
            expectContents(bySite[site], expected);
        });
    });
};

describe('rich-text-crdt black-box Quill contents', () => {
    describe('single-client edits', () => {
        const runSingleClient = (
            steps: Array<Array<QuillDelta>>,
            expected: QuillContents,
        ) => {
            const client = makeClient('a');
            applyQuillSteps(client, steps);
            expectContents(client, expected);
        };

        it('inserts text into an empty document', () => {
            runSingleClient([[{ insert: 'Hello' }]], {
                ops: [{ insert: 'Hello' }],
            });
        });

        it('inserts at the start, middle, and end', () => {
            runSingleClient(
                [
                    [{ insert: 'Helo' }],
                    [{ retain: 2 }, { insert: 'l' }],
                    [{ insert: 'Say ' }],
                    [{ retain: 9 }, { insert: '!' }],
                ],
                {
                    ops: [{ insert: 'Say Hello!' }],
                },
            );
        });

        it('deletes at the start, middle, and end', () => {
            runSingleClient(
                [
                    [{ insert: '0123456789' }],
                    [{ delete: 2 }],
                    [{ retain: 2 }, { delete: 3 }],
                    [{ retain: 3 }, { delete: 2 }],
                ],
                {
                    ops: [{ insert: '237' }],
                },
            );
        });

        it('deletes across text inserted by multiple prior edits', () => {
            runSingleClient(
                [
                    [{ insert: 'abde' }],
                    [{ retain: 2 }, { insert: 'c' }],
                    [{ retain: 1 }, { delete: 3 }],
                ],
                {
                    ops: [{ insert: 'ae' }],
                },
            );
        });

        it('replaces text using delete plus insert', () => {
            runSingleClient(
                [
                    [{ insert: 'Hello world' }],
                    [{ retain: 6 }, { delete: 5 }, { insert: 'CRDT' }],
                ],
                {
                    ops: [{ insert: 'Hello CRDT' }],
                },
            );
        });

        it('applies bold to a range', () => {
            runSingleClient(
                [
                    [{ insert: 'Hello' }],
                    [{ retain: 1 }, { retain: 3, attributes: { bold: true } }],
                ],
                {
                    ops: [
                        { insert: 'H' },
                        { insert: 'ell', attributes: { bold: true } },
                        { insert: 'o' },
                    ],
                },
            );
        });

        it('applies overlapping independent inline attributes', () => {
            runSingleClient(
                [
                    [{ insert: 'abcdef' }],
                    [{ retain: 1 }, { retain: 3, attributes: { bold: true } }],
                    [{ retain: 2 }, { retain: 3, attributes: { italic: true } }],
                ],
                {
                    ops: [
                        { insert: 'a' },
                        { insert: 'b', attributes: { bold: true } },
                        { insert: 'cd', attributes: { bold: true, italic: true } },
                        { insert: 'e', attributes: { italic: true } },
                        { insert: 'f' },
                    ],
                },
            );
        });

        it('removes an inline attribute with null', () => {
            runSingleClient(
                [
                    [{ insert: 'Hello' }],
                    [{ retain: 5, attributes: { bold: true } }],
                    [{ retain: 1 }, { retain: 3, attributes: { bold: null } }],
                ],
                {
                    ops: [
                        { insert: 'H', attributes: { bold: true } },
                        { insert: 'ell' },
                        { insert: 'o', attributes: { bold: true } },
                    ],
                },
            );
        });

        it('inserts text with attributes', () => {
            runSingleClient(
                [[{ insert: 'Hello' }], [{ retain: 5 }, { insert: '!', attributes: { bold: true } }]],
                {
                    ops: [
                        { insert: 'Hello' },
                        { insert: '!', attributes: { bold: true } },
                    ],
                },
            );
        });

        it('deletes text from inside a formatted range', () => {
            runSingleClient(
                [
                    [{ insert: 'abcdef' }],
                    [{ retain: 1 }, { retain: 4, attributes: { bold: true } }],
                    [{ retain: 2 }, { delete: 2 }],
                ],
                {
                    ops: [
                        { insert: 'a' },
                        { insert: 'be', attributes: { bold: true } },
                        { insert: 'f' },
                    ],
                },
            );
        });

        it('applies block-like newline attributes explicitly', () => {
            runSingleClient(
                [
                    [{ insert: 'Hello\n' }],
                    [{ retain: 5 }, { retain: 1, attributes: { list: 'bullet' } }],
                    [{ retain: 5 }, { insert: '\n', attributes: { list: 'bullet' } }],
                    [{ retain: 6 }, { insert: 'Ye' }],
                ],
                {
                    ops: [
                        { insert: 'Hello' },
                        { insert: '\n', attributes: { list: 'bullet' } },
                        { insert: 'Ye' },
                        { insert: '\n', attributes: { list: 'bullet' } },
                    ],
                },
            );
        });
    });

    describe('two-client convergence', () => {
        it('converges concurrent inserts at document start', () => {
            runConcurrent({
                a: [[{ insert: 'A' }]],
                b: [[{ insert: 'B' }]],
                expected: {
                    ops: [{ insert: 'BA' }],
                },
            });
        });

        it('converges concurrent inserts at the same middle position', () => {
            runConcurrent({
                initial: [[{ insert: 'ac' }]],
                a: [[{ retain: 1 }, { insert: 'b' }]],
                b: [[{ retain: 1 }, { insert: 'B' }]],
                expected: {
                    ops: [{ insert: 'acBb' }],
                },
            });
        });

        it.skip('BUG: preserves insert position inside a concurrent delete range', () => {
            runConcurrent({
                initial: [[{ insert: 'abcd' }]],
                a: [[{ retain: 1 }, { delete: 2 }]],
                b: [[{ retain: 2 }, { insert: 'X' }]],
                expected: {
                    ops: [{ insert: 'aXd' }],
                },
            });
        });

        it.skip('BUG: applies overlapping concurrent deletes completely', () => {
            runConcurrent({
                initial: [[{ insert: 'abcdef' }]],
                a: [[{ retain: 1 }, { delete: 3 }]],
                b: [[{ retain: 3 }, { delete: 2 }]],
                expected: {
                    ops: [{ insert: 'af' }],
                },
            });
        });

        it.skip('BUG: preserves concurrent same-range different-key formatting', () => {
            runConcurrent({
                initial: [[{ insert: 'abcd' }]],
                a: [[{ retain: 1 }, { retain: 2, attributes: { bold: true } }]],
                b: [[{ retain: 1 }, { retain: 2, attributes: { italic: true } }]],
                expected: {
                    ops: [
                        { insert: 'a' },
                        { insert: 'bc', attributes: { bold: true, italic: true } },
                        { insert: 'd' },
                    ],
                },
            });
        });

        it.skip('BUG: preserves overlapping same-key formatting by deterministic stamp order', () => {
            runConcurrent({
                initial: [[{ insert: 'abcd' }]],
                a: [[{ retain: 3, attributes: { bold: true } }]],
                b: [[{ retain: 1 }, { retain: 3, attributes: { bold: false } }]],
                expected: {
                    ops: [
                        { insert: 'a', attributes: { bold: true } },
                        { insert: 'bcd' },
                    ],
                },
            });
        });

        it('converges formatting over a concurrent delete', () => {
            runConcurrent({
                initial: [[{ insert: 'abcd' }]],
                a: [[{ retain: 4, attributes: { bold: true } }]],
                b: [[{ retain: 1 }, { delete: 2 }]],
                expected: {
                    ops: [{ insert: 'ad', attributes: { bold: true } }],
                },
            });
        });

        it.skip('BUG: preserves independent concurrent newline attributes', () => {
            runConcurrent({
                initial: [[{ insert: 'Hello\n' }]],
                a: [[{ retain: 5 }, { retain: 1, attributes: { list: 'bullet' } }]],
                b: [[{ retain: 5 }, { retain: 1, attributes: { indent: 1 } }]],
                expected: {
                    ops: [
                        { insert: 'Hello' },
                        { insert: '\n', attributes: { indent: 1, list: 'bullet' } },
                    ],
                },
            });
        });
    });

    describe('three-client convergence', () => {
        it('converges three concurrent inserts at document start', () => {
            runThreeConcurrent({
                a: [[{ insert: 'A' }]],
                b: [[{ insert: 'B' }]],
                c: [[{ insert: 'C' }]],
                expected: {
                    ops: [{ insert: 'CBA' }],
                },
            });
        });

        it('converges three independent inserts at different positions', () => {
            runThreeConcurrent({
                initial: [[{ insert: 'mid' }]],
                a: [[{ insert: 'A' }]],
                b: [[{ retain: 3 }, { insert: 'B' }]],
                c: [[{ retain: 1 }, { insert: 'C' }]],
                expected: {
                    ops: [{ insert: 'AmCidB' }],
                },
            });
        });
    });

    describe('merge convergence', () => {
        it('reifies the same contents when merging two concurrent inserts in either order', () => {
            const base = forkAfter([]);
            const a = makeClient('a', base);
            const b = makeClient('b', base);
            applyQuill(a, [{ insert: 'A' }]);
            applyQuill(b, [{ insert: 'B' }]);

            expectStateContents(merge(a.state, b.state), {
                ops: [{ insert: 'BA' }],
            });
            expectStateContents(merge(b.state, a.state), {
                ops: [{ insert: 'BA' }],
            });
        });

        it('reifies the same contents for associative merge of three concurrent inserts', () => {
            const base = forkAfter([]);
            const a = makeClient('a', base);
            const b = makeClient('b', base);
            const c = makeClient('c', base);
            applyQuill(a, [{ insert: 'A' }]);
            applyQuill(b, [{ insert: 'B' }]);
            applyQuill(c, [{ insert: 'C' }]);

            expectStateContents(merge(merge(a.state, b.state), c.state), {
                ops: [{ insert: 'CBA' }],
            });
            expectStateContents(merge(a.state, merge(b.state, c.state)), {
                ops: [{ insert: 'CBA' }],
            });
        });
    });
});
