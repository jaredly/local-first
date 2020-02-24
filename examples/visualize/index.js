// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as ncrdt from '../../packages/nested-object-crdt';
import * as debug from '../../packages/text-crdt/debug';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    deltaToChange,
    changeToDelta,
    type QuillDelta,
} from '../../packages/text-crdt/quill-deltas';
import QuillCursors from 'quill-cursors/dist/index.js';

Quill.register('modules/cursors', QuillCursors);

import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';

import { createChart } from './chart';

type QuillFormat = {
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
};
type Format = ncrdt.MapCRDT;

const mergeFormats = (one: Format, two: Format) => ncrdt.merge(one, two);

const initialDelta = {
    type: 'insert',
    span: {
        id: [0, '-initial-'],
        after: [0, crdt.rootSite],
        // text: 'Hello world! we did it.\n',
        text: '\n',
    },
};

const sync = editor => {
    if (editor.send && editor.other) {
        editor.waiting.forEach(change => {
            const deltas = changeToDelta(editor.other.state, change, format =>
                ncrdt.value(format),
            );
            crdt.apply(editor.other.state, change, mergeFormats);
            console.log('applying remote', change, deltas);
            editor.other.ui.updateContents(deltas, 'crdt');
        });
        editor.other.render(editor.other.state);
        editor.waiting = [];
    }
};

const createYjs = (div, render) => {
    const ydoc = new Y.Doc();
    ydoc.clientID = 0;
    //   const provider = new WebsocketProvider('wss://demos.yjs.dev', 'quill', ydoc)
    const type = ydoc.getText('quill');
    const editorContainer = document.createElement('div');
    editorContainer.setAttribute('id', 'editor');
    div.appendChild(editorContainer);

    var editor = new Quill(editorContainer, {
        modules: {
            cursors: true,
            toolbar: [
                [{ header: [1, 2, false] }],
                ['bold', 'italic', 'underline'],
                ['image', 'code-block'],
            ],
            history: {
                userOnly: true,
            },
        },
        placeholder: 'Start collaborating...',
        theme: 'snow', // or 'bubble'
    });

    editor.on('text-change', () => {
        // console.log(type);
        // console.log(Y.snapshot(ydoc));
        render(type);
    });

    const binding = new QuillBinding(type, editor, null);
};

const initQuill = (name, div, render: (crdt.CRDT<Format>) => void) => {
    const ui = new Quill(div, { theme: 'snow' });
    let clock = hlc.init(name, Date.now());
    const state: crdt.CRDT<Format> = crdt.init(name);
    crdt.apply(state, initialDelta, mergeFormats);
    ui.setText(crdt.toString(state));

    const editor = {
        div,
        ui,
        state,
        send: false,
        waiting: [],
        other: null,
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
                quillFormat => {
                    return ncrdt.createDeepMap(quillFormat, getStamp());
                },
            );
            console.log('got local', delta, changes);
            // console.log('delta', delta);
            // console.log(changes);
            changes.forEach(change => {
                crdt.apply(state, change, mergeFormats);
            });
            editor.waiting.push(...changes);
            sync(editor);
            render(state);
        },
    );
    render(state);
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
    // const chartC = createChart();
    const chartC = { node: document.createElement('div') };
    containerC.appendChild(chartC.node);
    createYjs(containerC, type => {
        chartC.node.innerHTML = '';
        const items = [];
        let current = type._start;
        while (current) {
            // console.log(type);
            const {
                id,
                origin,
                content,
                countable,
                keep,
                deleted,
                // redone,
            } = current;
            const node = document.createElement('div');
            const data = {
                id,
                origin,
                content,
                countable,
                keep,
                deleted,
                // redone,
            };
            node.textContent = JSON.stringify(data);
            chartC.node.appendChild(node);
            // items.push(data)
            current = current.right;
        }
        // chartC.node = JSON.stringify(items, null, 2)
    });
    // const chartB = createChart();
    // containerB.appendChild(chartB.node);

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
