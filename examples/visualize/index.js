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
        text: 'Hello world! we did it.\n',
        // text: '\n',
    },
};

const sync = editor => {
    if (editor.send && editor.other) {
        editor.waiting.forEach(change => {
            crdt.apply(editor.other.state, change, mergeFormats);
            const deltas = changeToDelta(editor.other.state, change, format =>
                ncrdt.value(format),
            );
            editor.other.ui.updateContents(deltas, 'crdt');
        });
        editor.other.render(editor.other.state);
        editor.waiting = [];
    }
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
    // const chart = init(_data);
}
