// @flow
import Quill from 'quill';
import * as crdt from '../../packages/rich-text-crdt';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    quillDeltasToDeltas,
    type QuillDelta,
} from '../../packages/rich-text-crdt/quill-deltas';
import { testSerialize } from '../../packages/rich-text-crdt/debug';
import QuillCursors from 'quill-cursors/dist/index.js';

const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'], // toggled buttons
    ['blockquote', 'code-block'],

    [{ header: 1 }, { header: 2 }], // custom button values
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
    [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
    [{ direction: 'rtl' }], // text direction

    [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
    [{ header: [1, 2, 3, 4, 5, 6, false] }],

    [{ color: [] }, { background: [] }], // dropdown with defaults from theme
    [{ font: [] }],
    [{ align: [] }],

    ['clean'], // remove formatting button
];

let last = 0;
const genStamp = () => {
    last += 1;
    return last.toString(36).padStart(5, '0');
};

const div = document.createElement('div');
document.body.appendChild(div);
const ui = new Quill(div, {
    theme: 'snow',
    // modules: { cursors: true, toolbar: toolbarOptions },
});

let state = crdt.init('a');

ui.on(
    'text-change',
    (delta: Array<QuillDelta<QuillFormat>>, oldDelta, source: string) => {
        if (source === 'crdt') {
            return;
        }
        const deltas = quillDeltasToDeltas(state, delta, genStamp);
        deltas.forEach(delta => (state = crdt.apply(state, delta)));
        console.log(testSerialize(state));
    },
);
