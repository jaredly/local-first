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

const initQuill = (name, div, render: (crdt.CRDT<Format>) => void) => {
    const ui = new Quill(div, { theme: 'snow' });
    let clock = hlc.init(name, Date.now());
    const state: crdt.CRDT<Format> = crdt.init(name);
    crdt.apply(state, initialDelta, mergeFormats);
    ui.setText(crdt.toString(state));

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
            render(state);
        },
    );
    render(state);
    return { div, ui, state };
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

    body.appendChild(containerA);
    body.appendChild(containerB);

    const a = initQuill('a', divA, chartA.render);
    const b = initQuill('b', divB, chartB.render);
    // const chart = init(_data);
}
