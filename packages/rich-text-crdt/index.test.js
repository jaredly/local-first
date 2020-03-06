//
import fixtures from './fixtures';
import deepEqual from 'fast-deep-equal';

import {
    apply,
    insert,
    del,
    format,
    init,
    inflate,
    walk,
    fmtIdx,
    toKey,
    getFormatValues,
} from './';
import { quillDeltasToDeltas, stateToQuillContents } from './quill-deltas';

const walkWithFmt = (state, fn) => {
    const format = {};
    const fmt = {};
    walk(state, node => {
        if (node.content.type === 'text') {
            fn(node.content.text, fmt);
        } else if (node.content.type === 'open') {
            if (!format[node.content.key]) {
                format[node.content.key] = [node.content];
            } else {
                const idx = fmtIdx(format[node.content.key], node.content);
                // insert into sorted order.
                format[node.content.key].splice(idx, 0, node.content);
            }
            fmt[node.content.key] = format[node.content.key][0].value;
        } else if (node.content.type === 'close') {
            const f = format[node.content.key];
            if (!f) {
                console.log('nope at the close', node.content);
            }
            const idx = f.findIndex(item => item.stamp === node.content.stamp);
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (f.length) {
                fmt[node.content.key] = f[0].value;
            } else {
                delete fmt[node.content.key];
            }
        }
    });
};

const justContents = state => {
    const res = [];
    walk(state, node => res.push(node.content));
    return res;
};

const testAltSerialize = state => {
    const res = [];
    walk(state, node => {
        if (node.content.type === 'text') {
            const fmt = getFormatValues(state, node.formats);
            if (res.length && deepEqual(res[res.length - 1].fmt, fmt)) {
                res[res.length - 1].text += node.content.text;
            } else {
                res.push({
                    text: node.content.text,
                    fmt,
                });
            }
        }
    });
    return res;
};

const testSerialize = state => {
    const res = [];
    walkWithFmt(state, (text, format) => {
        if (res.length && deepEqual(res[res.length - 1].fmt, format)) {
            res[res.length - 1].text += text;
        } else {
            res.push({ text, fmt: { ...format } });
        }
    });
    return res;
};

const actionToDeltas = (state, action) => {
    if (action.type === 'insert') {
        return insert(state, action.at, action.text, action.format);
    } else if (action.type === 'delete') {
        return [del(state, action.at, action.count)];
    } else if (action.type === 'fmt') {
        return [
            format(
                state,
                action.at,
                action.count,
                action.key,
                action.value,
                action.stamp,
            ),
        ];
    }
};

const runQuillTest = (deltas, result) => {
    let state = init('a');
    let i = 0;
    deltas.forEach(quillDelta => {
        const deltas = quillDeltasToDeltas(state, quillDelta.ops, () =>
            (i++).toString(36).padStart(5, '0'),
        );
        // console.log('quill', JSON.stringify(quillDelta));
        // console.log('state', JSON.stringify(state));
        // console.log('deltas', JSON.stringify(deltas));
        state = apply(state, deltas);
    });
    const contents = stateToQuillContents(state);
    expect(contents).toEqual(result);
};

const runActionsTest = actions => {
    let state = init('a');
    actions.forEach(action => {
        // console.log('action', action);
        if (action.state) {
            const ser = testSerialize(state);
            const alt = testAltSerialize(state);
            try {
                expect(ser).toEqual(alt, 'format caches wrong');
                expect(ser).toEqual(action.state, 'expected state wrong');
            } catch (err) {
                console.log(JSON.stringify(state));
                console.log(JSON.stringify(ser));
                throw err;
            }
        } else if (action.contents) {
            const contents = justContents(state);
            expect(contents.length).toEqual(action.contents.length);
            contents.forEach((c, i) => {
                expect(c).toEqual(expect.objectContaining(action.contents[i]));
            });
        } else if (action.parallel) {
            let pre = { ...state };
            const states = { a: { deltas: [], state } };
            Object.keys(action.parallel).forEach(site => {
                if (!states[site]) {
                    states[site] = {
                        deltas: [],
                        state: inflate(site, pre.roots, pre.map),
                    };
                }
                action.parallel[site].forEach(subAction => {
                    const deltas = actionToDeltas(
                        states[site].state,
                        subAction,
                    );
                    deltas.forEach(delta => {
                        states[site].state = apply(states[site].state, delta);
                        states[site].deltas.push(delta);
                    });
                });
            });
            state = states.a.state;
            Object.keys(action.parallel).forEach(site => {
                if (site !== state.site) {
                    states[site].deltas.forEach(delta => {
                        state = apply(state, delta);
                    });
                }
            });
        } else {
            // console.log('for state', JSON.stringify(state));
            const deltas = actionToDeltas(state, action);
            deltas.forEach(delta => {
                // console.log('delta', JSON.stringify(delta));
                state = apply(state, delta);
            });
        }
    });
};

describe('rich-text-crdt', () => {
    fixtures.forEach((test, i) => {
        const title = test.title ? test.title : 'should work ' + i;
        // const i = test.only ? it.only : it;
        const body = () => {
            if (test.quillDeltas) {
                runQuillTest(test.quillDeltas, test.quillResult);
            } else {
                const actions = test.actions ? test.actions : test;
                runActionsTest(actions);
            }
        };
        if (test.only) {
            it.only(title, body);
        } else {
            it(title, body);
        }
        // t(title, body);
    });
});
