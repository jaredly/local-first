// @flow
import fixtures from './fixtures';
import deepEqual from 'fast-deep-equal';

import {
    apply,
    insert,
    del,
    format,
    init,
    walk,
    fmtIdx,
    toKey,
    getFormatValues,
    merge,
} from './';
import { quillDeltasToDeltas, stateToQuillContents } from './quill-deltas';

const walkWithFmt = (state, fn) => {
    const format = {};
    const fmt = {};
    walk(state, node => {
        const { content } = node;
        if (content.type === 'text') {
            fn(content.text, fmt);
        } else if (content.type === 'open') {
            if (!format[content.key]) {
                format[content.key] = [content];
            } else {
                const idx = fmtIdx(format[content.key], content);
                // insert into sorted order.
                format[content.key].splice(idx, 0, content);
            }
            fmt[content.key] = format[content.key][0].value;
        } else if (content.type === 'close') {
            const f = format[content.key];
            if (!f) {
                console.log('nope at the close', content);
            }
            const idx = f.findIndex(item => item.stamp === content.stamp);
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (f.length) {
                fmt[content.key] = f[0].value;
            } else {
                delete fmt[content.key];
            }
        }
    });
};

const justContents = (state, all) => {
    const res = [];
    walk(
        state,
        node => {
            res.push(node.content);
        },
        all,
    );
    return res;
};

const testAltSerialize = state => {
    const res = [];
    walk(state, ({ content, formats }) => {
        if (content.type === 'text') {
            const fmt = getFormatValues(state, formats);
            if (res.length && deepEqual(res[res.length - 1].fmt, fmt)) {
                res[res.length - 1].text += content.text;
            } else {
                res.push({
                    text: content.text,
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

const actionToDeltas = (
    state,
    site: string,
    action:
        | {
              type: 'insert',
              at: number,
              text: string,
              format: any,
          }
        | {
              type: 'delete',
              at: number,
              count: number,
          }
        | {
              type: 'fmt',
              at: number,
              count: number,
              key: string,
              value: any,
              stamp: string,
          },
) => {
    if (action.type === 'insert') {
        return insert(state, site, action.at, action.text, action.format);
    } else if (action.type === 'delete') {
        return [del(state, action.at, action.count)];
    } else if (action.type === 'fmt') {
        return [
            format(
                state,
                site,
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
    let state = init();
    let i = 0;
    deltas.forEach(quillDelta => {
        const { state: nw, deltas } = quillDeltasToDeltas(
            state,
            'a',
            quillDelta.ops,
            () => (i++).toString(36).padStart(5, '0'),
        );
        state = nw;
        // state = apply(state, deltas);
    });
    const contents = stateToQuillContents(state);
    expect(contents).toEqual(result);
};

const runActionsTest = actions => {
    const baseSite = 'a';
    let state = init();
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
            const contents = justContents(state, action.all);
            contents.forEach((c, i) => {
                expect(c).toEqual(expect.objectContaining(action.contents[i]));
            });
            expect(contents.length).toEqual(action.contents.length);
        } else if (action.parallel) {
            let pre = { ...state };
            const states = { a: { deltas: [], state } };
            Object.keys(action.parallel).forEach(site => {
                if (!states[site]) {
                    states[site] = {
                        deltas: [],
                        state: pre,
                    };
                }
                action.parallel[site].forEach(subAction => {
                    const deltas = actionToDeltas(
                        states[site].state,
                        site,
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
                if (site !== 'a') {
                    states[site].deltas.forEach(delta => {
                        state = apply(state, delta);
                    });
                }
            });
        } else {
            const deltas = actionToDeltas(state, 'a', action);
            deltas.forEach(delta => {
                // const qd = deltaToQuillDeltas(state, delta)
                state = apply(state, delta);
                // const back = quillDeltasToDeltas(state, qd, genStamp)
            });
        }
        // expect(merge(state, state)).toEqual(state);
    });
};

describe('rich-text-crdt', () => {
    fixtures.forEach((test, i) => {
        const title = test.title ? test.title : 'should work ' + i;
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
    });
});
