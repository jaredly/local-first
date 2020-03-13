// @flow
import Quill from 'quill';
// import * as crdt from '../../packages/text-crdt/tree';
// import * as ncrdt from '../../packages/nested-object-crdt';
import * as debug from '../../packages/text-crdt/debug';
import * as hlc from '../../packages/hybrid-logical-clock';
// import {
//     deltaToChange,
//     changeToDelta,
//     initialDelta,
//     type QuillDelta,
// } from '../../packages/text-crdt/quill-deltas';
import QuillCursors from 'quill-cursors/dist/index.js';
import deepEqual from 'fast-deep-equal';

import * as crdt from '../../packages/rich-text-crdt';
import {
    quillDeltasToDeltas,
    deltasToQuillDeltas,
    stateToQuillContents,
    initialQuillDelta,
} from '../../packages/rich-text-crdt/quill-deltas';

Quill.register('modules/cursors', QuillCursors);

import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';

import { createChart } from './new-chart';
import { createYChart } from './y-chart';

type QuillFormat = {
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
};
type Format = ncrdt.MapCRDT;

const mergeFormats = (one: any, two: any): any => ncrdt.merge(one, two);

const sync = editor => {
    if (editor.send && editor.other) {
        editor.waiting.forEach(change => {
            const result = deltasToQuillDeltas(editor.other.state, change);
            editor.other.state = result.state;
            // crdt.apply(editor.other.state, change, mergeFormats);
            console.log('applying remote', change, result.quillDeltas);
            result.quillDeltas.forEach(deltas => {
                editor.other.ui.updateContents(deltas, 'crdt');
            });
        });
        editor.other.render(editor.other.state);
        editor.waiting = [];
    }
};

const createYjs = (div, render) => {
    const ydoc = new Y.Doc();
    ydoc.clientID = 0;
    const type = ydoc.getText('quill');
    const editorContainer = document.createElement('div');
    editorContainer.setAttribute('id', 'editor');
    div.appendChild(editorContainer);

    var editor = new Quill(editorContainer, {
        modules: {
            cursors: true,
        },
        placeholder: 'Yjs editor',
        theme: 'bubble',
    });

    editor.on('text-change', () => {
        console.log(type);
        render(type);
    });

    const binding = new QuillBinding(type, editor, null);
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

const initQuill = (name, div, render: crdt.CRDT => void) => {
    const ui = new Quill(div, { theme: 'bubble', placeholder: 'Quill editor' });
    let clock = hlc.init(name, Date.now());
    let state: crdt.CRDT = crdt.init(name);
    state = crdt.apply(state, initialQuillDelta);
    // ui.setText(crdt.toString(state));

    const editor = {
        div,
        ui,
        state,
        send: false,
        waiting: [],
        other: (null: ?any),
        render,
    };

    // let clock = hlc.init(name, Date.now());
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
        (delta: Array<QuillDelta>, oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            const res = quillDeltasToDeltas(editor.state, delta, getStamp);
            editor.state = res.state;
            console.log('got local', delta, res.deltas);
            // console.log('delta', delta);
            // console.log(changes);
            // changes.forEach(change => {
            //     crdt.apply(state, change, mergeFormats);
            // });
            editor.waiting.push(res.deltas);
            sync(editor);
            render(editor.state);
        },
    );
    render(editor.state);
    return editor;
};

if (document.body) {
    const body = document.body;
    const containerA = document.createElement('div');

    const divA = document.createElement('div');
    containerA.appendChild(divA);
    const chartA = createChart();
    containerA.appendChild(chartA.node);

    const containerB = document.createElement('div');
    const divB = document.createElement('div');
    containerB.appendChild(divB);
    const chartB = createChart();
    containerB.appendChild(chartB.node);

    const a = initQuill('a', divA, chartA.render);
    const b = initQuill('b', divB, chartB.render);
    a.other = b;
    b.other = a;

    const containerC = document.createElement('div');
    const divC = document.createElement('div');
    containerC.appendChild(divC);
    const chartC = createYChart();
    // const chartC = { node: document.createElement('div') };
    containerC.appendChild(chartC.node);
    createYjs(containerC, chartC.render);

    const buttons = document.createElement('div');
    [
        {
            title: '⬇️',
            action: button => {
                button.classList.toggle('active');
                a.send = button.classList.contains('active');
                sync(a);
            },
        },
        {
            title: '⬆️',
            action: button => {
                button.classList.toggle('active');
                b.send = button.classList.contains('active');
                sync(b);
            },
        },
    ].forEach(button => {
        const node = document.createElement('button');
        node.textContent = button.title;
        node.onclick = () => {
            button.action(node);
        };
        node.style.border = 'none';
        // node.style.background = 'transparent';
        buttons.appendChild(node);
    });

    body.appendChild(containerA);
    body.appendChild(buttons);
    body.appendChild(containerB);
    body.appendChild(containerC);
    // const chart = init(_data);
}
