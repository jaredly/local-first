// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as rcrdt from '../../packages/rich-text-crdt';
import * as rcrdtq from '../../packages/rich-text-crdt/quill-deltas';
import * as ncrdt from '../../packages/nested-object-crdt';
import * as debug from '../../packages/text-crdt/debug';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    deltaToChange,
    changeToDelta,
    type QuillDelta,
} from '../../packages/text-crdt/quill-deltas';
import QuillCursors from 'quill-cursors/dist/index.js';
import automerge from 'automerge';
import transit from 'transit-js';
import deepEqual from 'fast-deep-equal';
window.transit = transit;

Quill.register('modules/cursors', QuillCursors);

import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';

import { createChart } from './chart';
import { createChart as createNewChart } from './new-chart';
import { createYChart } from './y-chart';

type QuillFormat = {
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
};
type Format = ncrdt.MapCRDT;

const mergeFormats = (one: any, two: any): any => ncrdt.merge(one, two);

const initialDelta = {
    type: 'insert',
    span: {
        id: [0, '-initial-'],
        after: [0, crdt.rootSite],
        // text: 'Hello world! we did it.\n',
        text: '\n',
    },
};

const createAutomerge = (editor, render) => {
    let doc = automerge.init('a');
    doc = automerge.change(
        doc,
        doc => (doc.text = new automerge.Text(editor.getText())),
    );

    function applyDeltaToText(text, delta) {
        let i = 0;
        delta.forEach((op, idx) => {
            if (op.retain) {
                i += op.retain;
            }

            if (typeof op.insert === 'string') {
                const chars = op.insert.split('');
                text.insertAt(i, ...chars);
                i += chars.length;
            } else if (op.delete) {
                text.deleteAt(i, op.delete);
            }
        });
    }
    const getObject = (doc, key) => {
        const data = automerge.Frontend.getBackendState(doc).toJS();
        const baseID = '00000000-0000-0000-0000-000000000000';
        const base = data.opSet.byObject[baseID];
        return {
            text: data.opSet.byObject[base._keys[key][0].value],
            history: data.opSet.history,
        };
    };
    window.automerge = automerge;
    editor.on('text-change', delta => {
        doc = automerge.change(doc, doc => {
            applyDeltaToText(doc.text, delta);
        });
        window.autodoc = doc;
        render(getObject(doc, 'text'));
    });
    render(getObject(doc, 'text'));
};

const createYjs = (editor, render) => {
    const ydoc = new Y.Doc();
    ydoc.clientID = 0;
    const type = ydoc.getText('quill');

    editor.on('text-change', () => {
        console.log(type);
        render(type);
    });

    const binding = new QuillBinding(type, editor, null);
    return type;
};

const matchesFormat = (format: Format, quill: QuillFormat) => {
    return !Object.keys(quill).some(key => {
        return (
            !format.map[key] ||
            !deepEqual(ncrdt.value(format.map[key]), quill[key])
        );
    });
};

const createQuillFormat = getStamp => (quillFormat, preFormat, postFormat) => {
    if (preFormat && matchesFormat(preFormat, quillFormat)) {
        return preFormat;
    }
    if (postFormat && matchesFormat(postFormat, quillFormat)) {
        return postFormat;
    }
    return ncrdt.createDeepMap(quillFormat, getStamp());
};

const initMineNew = (name, ui, render: rcrdt.CRDT => void) => {
    let clock = hlc.init(name, Date.now());
    let state: rcrdt.CRDT = rcrdt.init(name);
    state = rcrdt.apply(state, rcrdtq.initialQuillDelta);
    // ui.setText(rcrdt.toString(state));

    const editor = {
        ui,
        state,
        send: false,
        waiting: [],
        other: (null: ?any),
        render,
    };

    const getStamp = () => {
        const next = hlc.inc(clock, Date.now());
        clock = next;
        return hlc.pack(next);
    };
    const recvStamp = stamp => {
        const next = hlc.recv(clock, hlc.unpack(stamp), Date.now());
        clock = next;
    };

    ui.on(
        'text-change',
        (delta: Array<rcrdt.QuillDelta>, oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            const result = rcrdtq.quillDeltasToDeltas(
                editor.state,
                delta,
                getStamp,
            );
            editor.state = result.state;
            console.log('rendering');
            render(editor.state);
        },
    );
    render(editor.state);
    return editor;
};

const initMineOld = (name, ui, render: (crdt.CRDT<Format>) => void) => {
    let clock = hlc.init(name, Date.now());
    const state: crdt.CRDT<Format> = crdt.init(name);
    crdt.apply(state, initialDelta, mergeFormats);
    // ui.setText(crdt.toString(state));

    const editor = {
        ui,
        state,
        send: false,
        waiting: [],
        other: (null: ?any),
        render,
    };

    const getStamp = () => {
        const next = hlc.inc(clock, Date.now());
        clock = next;
        return hlc.pack(next);
    };
    const recvStamp = stamp => {
        const next = hlc.recv(clock, hlc.unpack(stamp), Date.now());
        clock = next;
    };

    ui.on(
        'text-change',
        (delta: Array<QuillDelta<QuillFormat>>, oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            const changes = deltaToChange<QuillFormat, Format>(
                state,
                delta,
                createQuillFormat(getStamp),
            );
            changes.forEach(change => {
                crdt.apply(state, change, mergeFormats);
            });
            console.log('rendering');
            render(state);
        },
    );
    render(state);
    return editor;
};

const node = (tag, attrs, children) => {
    const node = document.createElement(tag);
    if (attrs) {
        Object.keys(attrs).forEach(attr => {
            if (attr === 'style') {
                Object.assign(node.style, attrs[attr]);
            } else if (typeof attrs[attr] === 'function') {
                // $FlowFixMe
                node[attr] = attrs[attr];
            } else {
                node.setAttribute(attr, attrs[attr]);
            }
        });
    }
    if (children) {
        const add = child => {
            if (Array.isArray(child)) {
                child.forEach(add);
            } else if (typeof child === 'string' || typeof child === 'number') {
                node.appendChild(document.createTextNode(child.toString()));
            } else if (child) {
                node.appendChild(child);
            }
        };
        add(children);
    }
    return node;
};
const div = (attrs, children) => node('div', attrs, children);
const span = (attrs, children) => node('span', attrs, children);

const addDiv = (attrs, children) => {
    const node = div(attrs, children);
    // $FlowFixMe
    document.body.appendChild(node);
    return node;
};

if (document.body) {
    const body = document.body;
    const editorContainer = addDiv();

    const editor = new Quill(editorContainer, {
        modules: {
            cursors: true,
        },
        placeholder: 'Text editor',
        theme: 'snow',
    });

    body.appendChild(
        node('h3', {}, [
            node('a', { href: 'https://github.com/yjs/yjs' }, 'Y.js'),
        ]),
    );

    const yChart = createYChart();
    const yNode = addDiv();
    yNode.appendChild(yChart.node);
    const yType = createYjs(editor, yChart.render);

    body.appendChild(
        node('h3', {}, [
            node(
                'a',
                {
                    href:
                        'https://github.com/jaredly/local-first/tree/master/packages/rich-text-crdt',
                },
                'Mine (new)',
            ),
        ]),
    );

    const myNewChart = createNewChart();
    const myNewNode = addDiv();
    myNewNode.appendChild(myNewChart.node);
    initMineNew('a', editor, myNewChart.render);

    body.appendChild(
        node('h3', {}, [
            node(
                'a',
                {
                    href:
                        'https://github.com/jaredly/local-first/tree/master/packages/text-crdt',
                },
                'Mine (old)',
            ),
        ]),
    );

    const myChart = createChart();
    const myNode = addDiv();
    myNode.appendChild(myChart.node);
    initMineOld('a', editor, myChart.render);

    body.appendChild(
        node('h3', {}, [
            node(
                'a',
                { href: 'https://github.com/automerge/automerge' },
                'Automerge',
            ),
        ]),
    );

    const autoDiv = addDiv();

    const auto = createAutomerge(editor, ({ history, text }) => {
        console.log('automerge', history, text);
        // const initial = `${text._init.actor}:${text._init.seq}`;
        const tree = {};
        const map = {};
        const follow = id => {
            const children = text._following[id].map(
                ins => `${ins.actor}:${ins.seq}`,
            );
            map[id] = {
                id,
                text: text._keys[id] ? text._keys[id][0].value : '',
                children,
            };
        };
        follow('_head');
        // return;

        autoDiv.innerHTML = '';
        const historyDiv = div({
            style: { maxHeight: '400px', overflow: 'auto' },
        });
        autoDiv.appendChild(historyDiv);
        history.forEach(item => {
            const node = div({}, [
                span({ style: { fontWeight: 'bold' } }, [
                    `${item.seq}:${item.actor}`,
                ]),
                item.ops
                    .map(op => {
                        if (op.action === 'ins') {
                            return `ins(${op.key}, ${item.actor}:${op.elem})`;
                        }
                        if (op.action === 'set') {
                            return `${op.key}=${JSON.stringify(op.value)}`;
                        }
                        if (op.action === 'del') {
                            return span(
                                { style: { textDecoration: 'line-through' } },
                                op.key,
                            );
                        }
                        if (op.action === 'link') {
                            return `link(${op.key}, ${op.value.slice(
                                0,
                                5,
                            )}...)`;
                        }
                        if (op.action === 'makeText') {
                            return `makeText(${op.obj.slice(0, 5)}...)`;
                        }
                        return JSON.stringify(op);
                    })
                    .map(text =>
                        span(
                            {
                                style: {
                                    padding: '2px 4px',
                                    display: 'inline-block',
                                },
                            },
                            text,
                        ),
                    ),
            ]);
            historyDiv.appendChild(node);
        });
        historyDiv.scrollTop = historyDiv.scrollHeight;
        window.text = text;
        // window.last = automerge.save(text);
    });
}
