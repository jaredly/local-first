// @flow
import Quill from 'quill';
import * as crdt from '../../packages/rich-text-crdt';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    quillDeltasToDeltas,
    stateToQuillContents,
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
const initialText = 'Hello\n';
state = crdt.apply(state, crdt.insert(state, 0, initialText));
ui.setText(initialText);

const allDeltas = [];
allDeltas.push({ ops: [{ insert: initialText }] });

const toNode = item => {
    let inner = document.createTextNode(item.text);
    Object.keys(item.fmt).forEach(key => {
        if (item.fmt[key] == null) {
            return;
        }
        const node = document.createElement(
            {
                bold: 'strong',
                italic: 'em',
                link: 'a',
            }[key],
        );
        if (key === 'link') {
            node.href = item.fmt[key];
        }
        node.appendChild(inner);
        inner = node;
    });
    return inner;
};

const toDom = (div, state) => {
    div.innerHTML = '';
    testSerialize(state, true).forEach(item => {
        div.appendChild(toNode(item));
    });
};

const output = document.createElement('div');
document.body.appendChild(output);

const textarea = document.createElement('textarea');
document.body.appendChild(textarea);

const backToQuill = document.createElement('textarea');
document.body.appendChild(backToQuill);

ui.on(
    'text-change',
    (delta: Array<QuillDelta<QuillFormat>>, oldDelta, source: string) => {
        if (source === 'crdt') {
            return;
        }

        allDeltas.push(delta);
        textarea.value = `{\n  title: "",\n  quillDeltas: ${JSON.stringify(
            allDeltas,
        )},\n  quillResult: ${JSON.stringify(ui.getContents())}\n}`;

        const deltas = quillDeltasToDeltas(state, delta, genStamp);
        deltas.forEach(delta => (state = crdt.apply(state, delta)));
        console.log(testSerialize(state));
        console.log(state);
        toDom(output, state);
        backToQuill.value = JSON.stringify(stateToQuillContents(state));
    },
);
