//
import fixtures from './fixtures';
import deepEqual from 'fast-deep-equal';

import { apply, insert, del, format, init, inflate } from './';

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

const fmtIdx = (fmt, content) => {
    for (let i = 0; i < fmt.length; i++) {
        if (fmt[i].stamp < content.stamp) {
            return i;
        }
    }
    return fmt.length;
};

const walkWithFmt = (state, fn) => {
    const format = {};
    const fmt = {};
    walk(state, node => {
        if (node.content.type === 'text') {
            fn(node.content.text, fmt);
        } else if (node.content.type === 'open') {
            if (!format[node.content.key]) {
                format[node.content.key] = [node.content];
                // console.log(`New thing`, node.content);
            } else {
                // not unshift...
                const idx = fmtIdx(format[node.content.key], node.content);
                // console.log(
                //     `Adding in format ${node.content.key}=${node.content.value} (${node.content.stamp})`,
                //     idx,
                // );
                // insert into sorted order.
                format[node.content.key].splice(idx, 0, node.content);
            }
            fmt[node.content.key] = format[node.content.key][0].value;
            // console.log(`Current value`, fmt[node.content.key]);
        } else if (node.content.type === 'close') {
            const f = format[node.content.key];
            if (!f) {
                console.log('nope at the close', node.content);
            }
            // TODO this won't work for objects as format
            const idx = f.findIndex(item => item.stamp === node.content.stamp);
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (f.length) {
                fmt[node.content.key] = f[0].value;
            } else {
                delete fmt[node.content.key];
            }
            // console.log(
            //     `Closed (${node.content.stamp}), new value ${
            //         node.content.key
            //     }=${fmt[node.content.key]}`,
            // );
        }
    });
};

const showContents = contents => {
    if (contents.type === 'text') {
        return `text(${contents.text})`;
    } else if (contents.type === 'open') {
        return `>${contents.key}(${contents.value}):${contents.stamp}`;
    } else {
        return `<${contents.key}:${contents.stamp}`;
    }
};

const justContents = state => {
    const res = [];
    walk(state, node => res.push(showContents(node.content)));
    return res;
};

const testSerialize = state => {
    // console.log(JSON.stringify(state.map));
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

const actionToDelta = (state, action) => {
    if (action.type === 'insert') {
        return insert(state, action.at, action.text);
    } else if (action.type === 'delete') {
        return del(state, action.at, action.count);
    } else if (action.type === 'fmt') {
        return format(
            state,
            action.at,
            action.count,
            action.key,
            action.value,
            action.stamp,
        );
    }
};

describe('rich-text-crdt', () => {
    fixtures.forEach((actions, i) => {
        it('should work ' + i, () => {
            let state = init('a');
            actions.forEach(action => {
                // console.log('action', action);
                if (action.state) {
                    try {
                        expect(testSerialize(state)).toEqual(action.state);
                    } catch (err) {
                        console.log(JSON.stringify(state));
                        throw err;
                    }
                } else if (action.contents) {
                    expect(justContents(state)).toEqual(action.contents);
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
                            const delta = actionToDelta(
                                states[site].state,
                                subAction,
                            );
                            states[site].state = apply(
                                states[site].state,
                                delta,
                            );
                            states[site].deltas.push(delta);
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
                    const delta = actionToDelta(state, action);
                    state = apply(state, delta);
                }
            });
        });
    });
});
