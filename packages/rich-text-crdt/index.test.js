//
import fixtures from './fixtures';
import deepEqual from 'fast-deep-equal';

import { apply, insert, del, format, init } from './';

const walk = (state, fn) => {
    const loop = id => {
        const node = state.map[id];
        if (!node) return console.error(`Missing node! ${id}`);
        if (!node.deleted) {
            fn(node);
        }
        state.map[id].children.forEach(child => loop(child));
    };
    state.roots.forEach(id => loop(id));
};

const walkWithFmt = (state, fn) => {
    const format = {};
    const fmt = {};
    walk(state, node => {
        console.log('walk', node);
        if (node.content.type === 'text') {
            fn(node.content.text, fmt);
        } else if (node.content.type === 'open') {
            if (!format[node.content.key]) {
                format[node.content.key] = [node.content.value];
            } else {
                format[node.content.key].unshift(node.content.value);
            }
            fmt[node.content.key] = node.content.value;
        } else if (node.content.type === 'close') {
            const f = format[node.content.key];
            // TODO this won't work for objects as format
            const idx = f.indexOf(node.content.value);
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (f.length) {
                fmt[node.content.key] = f[0];
            } else {
                delete fmt[node.content.key];
            }
        }
    });
};

const testSerialize = state => {
    console.log(JSON.stringify(state.map));
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

describe('rich-text-crdt', () => {
    fixtures.forEach((actions, i) => {
        it('should work ' + i, () => {
            let state = init('a');
            actions.forEach(action => {
                console.log('action', action);
                if (action.state) {
                    expect(testSerialize(state)).toEqual(action.state);
                } else {
                    if (action.type === 'insert') {
                        state = apply(
                            state,
                            insert(state, action.at, action.text),
                        );
                        console.log('applied', state);
                    } else if (action.type === 'delete') {
                        state = apply(
                            state,
                            del(state, action.at, action.count),
                        );
                    } else if (action.type === 'fmt') {
                        state = apply(
                            state,
                            format(
                                state,
                                state.at,
                                state.count,
                                state.key,
                                state.value,
                            ),
                        );
                    }
                }
            });
        });
    });
});
