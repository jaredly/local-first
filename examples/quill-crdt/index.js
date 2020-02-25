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

const editors = {};

type QuillFormat = {
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
};
type Format = ncrdt.MapCRDT;

const mergeFormats = (one, two) => ncrdt.merge(one, two);
// Need initialDelta to match whata Quill expects
const initialDelta = {
    type: 'insert',
    span: {
        id: [0, '-initial-'],
        after: [0, crdt.rootSite],
        text: 'Hello world! we did it.\n',
    },
};

const columns = [document.createElement('div'), document.createElement('div')];
if (document.body) {
    const body = document.body;
    columns.forEach(column => body.appendChild(column));
}

/*
How to deal with formatting?

because the format CRDTs will be very many, and not necessarily consistent.
But we want to reuse what we can.


*/
var toolbarOptions = [
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

const addEditor = (name, broadcast, accept, subtitle, color) => {
    const container = document.createElement('div');
    const div = document.createElement('div');
    div.id = name;
    container.appendChild(div);
    // div.style.marginBottom = '12px';
    const description = document.createElement('div');
    description.innerText = subtitle;
    Object.assign(description.style, {
        paddingBottom: '18px',
        paddingTop: '6px',
        paddingLeft: '6px',
        fontSize: '10px',
        fontFamily: 'system-ui',
    });
    container.appendChild(description);
    columns[Object.keys(editors).length % 2].appendChild(container);

    const clock = hlc.init(name, Date.now());
    const state = crdt.init(name);
    crdt.apply(state, initialDelta, mergeFormats);

    const ui = new Quill(div, {
        theme: 'snow',
        modules: { cursors: true, toolbar: toolbarOptions },
    });
    ui.setText(crdt.toString(state));

    const cursors = ui.getModule('cursors');

    Object.keys(editors).forEach(id => {
        cursors.createCursor(id, id, editors[id].color);
        editors[id].cursors.createCursor(name, name, color);
    });

    const editor = (editors[name] = {
        clock,
        color,
        state,
        ui,
        cursors,
        broadcast,
        accept,
    });

    const getStamp = () => {
        const next = hlc.inc(editor.clock, Date.now());
        editor.clock = next;
        return hlc.pack(next);
    };
    const recvStamp = stamp => {
        const next = hlc.recv(editor.clock, hlc.unpack(stamp), Date.now());
        editor.clock = next;
    };

    if (broadcast) {
        editors[name].ui.on('selection-change', (range, oldRange, source) => {
            if (!range) return;
            const tr = quillToTreePos(editors[name].state, range);
            Object.keys(editors).forEach(id => {
                if (id !== name && editors[id].accept) {
                    editors[id].cursors.moveCursor(
                        name,
                        treeToQuillPos(editors[id].state, tr),
                    );
                }
            });
        });
    }

    editors[name].ui.on(
        'text-change',
        (delta: Array<QuillDelta<QuillFormat>>, oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            const changes = deltaToChange(
                editors[name].state,
                delta,
                // Sooo what I really want is: prev format & this format.
                // So what are the things that are changing?
                // But maybe this is fine? At least for now.
                quillFormat => {
                    return ncrdt.createValue(quillFormat, getStamp());
                },
            );
            console.log('changes', JSON.stringify(changes));
            const preRanges = calcCursorPositions(editors[name]);
            changes.forEach(change => {
                crdt.apply(editors[name].state, change, mergeFormats);
            });
            updateCursorPositions(editors[name], preRanges);
            if (broadcast) {
                changes.forEach(change => {
                    Object.keys(editors).forEach(id => {
                        const editor = editors[id];
                        if (id !== name && editor.accept) {
                            const preRanges = calcCursorPositions(editor);

                            crdt.apply(editor.state, change, mergeFormats);
                            const deltas = changeToDelta(
                                editor.state,
                                change,
                                format => ncrdt.value(format),
                            );
                            editor.ui.updateContents(deltas, 'crdt');
                            console.log(crdt.toString(editor.state));
                            updateCursorPositions(editor, preRanges);
                        }
                    });
                });
            }
        },
    );
};

const treeToQuillPos = (state, range) => {
    const start = crdt.locToPos(state, range.start);
    const end = crdt.locToPos(state, range.end);
    return { index: start, length: end - start };
};
const quillToTreePos = (state, range) => {
    const start = crdt.posToLoc(state, range.index, false);
    const end = crdt.posToLoc(state, range.index + range.length, true);
    return { start, end };
};

const updateCursorPositions = (editor, preRanges) => {
    editor.cursors.cursors().forEach(cursor => {
        if (!preRanges[cursor.id]) return;
        editor.cursors.moveCursor(
            cursor.id,
            treeToQuillPos(editor.state, preRanges[cursor.id]),
        );
    });
};

const calcCursorPositions = editor => {
    const preRanges = {};
    editor.cursors.cursors().forEach(cursor => {
        if (!cursor.range) return;
        preRanges[cursor.id] = quillToTreePos(editor.state, cursor.range);
    });

    return preRanges;
};

addEditor('one', true, true, 'Full sync', 'red');
addEditor('two', true, true, 'Full sync', 'green');
addEditor('three', true, true, 'Full sync', 'blue');
addEditor('four', false, true, `Receives, but doesn't broadcast`, 'orange');
addEditor('five', true, false, `Broadcasts, but doesn't receive`, 'purple');
