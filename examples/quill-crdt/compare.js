// @flow
import { node, div, span, addDiv } from './node';
import Quill from 'quill';
import QuillCursors from 'quill-cursors/dist/index.js';
import * as Y from 'yjs';
Quill.register('modules/cursors', QuillCursors);
import { QuillBinding } from 'y-quill';

const make = (name, crdt) => {
    const ui1div = div();
    const ui2div = div();
    let syncing = false;
    const button = node(
        'button',
        {
            onclick: () => {
                if (syncing) {
                    button.textContent = 'Disconnected';
                    syncing = false;
                } else {
                    button.textContent = 'Connected';
                    syncing = true;
                    sync();
                }
            },
        },
        ['Disconnected'],
    );
    addDiv({}, [node('h2', {}, [name]), ui1div, button, ui2div]);
    const ui1 = new Quill(ui1div, { theme: 'snow' });
    const ui2 = new Quill(ui2div, { theme: 'snow' });
    const state1 = crdt.init('1');
    const waiting1 = [];
    const state2 = crdt.init('2');
    const waiting2 = [];

    const sync = () => {
        if (syncing) {
            crdt.applyChanges(waiting1, state1, ui1);
            crdt.applyChanges(waiting2, state2, ui2);
            console.log(waiting1.splice(0, waiting1.length));
            console.log(waiting2.splice(0, waiting2.length));
        }
    };

    crdt.connect(state1, ui1, change => {
        waiting2.push(change);
        sync();
    });

    crdt.connect(state2, ui2, change => {
        waiting1.push(change);
        sync();
    });
};

make('Yjs', {
    init: id => new Y.Doc(),
    connect: (doc, quill, onChange) => {
        const type = doc.getText('quill');
        const binding = new QuillBinding(type, quill, null);
        doc.on('update', update => onChange(update));
    },
    applyChanges: (changes, doc, quill) => {
        changes.forEach(change => Y.applyUpdate(doc, change));
    },
});

// make('Mine (old)', {
//     init: id => ocrdt.init(id),
//     connect: (doc, quill, onChange) => {
//         quill.on(
//             'text-change',
//             (
//                 delta: Array<QuillDelta<QuillFormat>>,
//                 oldDelta,
//                 source: string,
//             ) => {
//                 if (source === 'crdt') {
//                     return;
//                 }
//                 const changes = ocrdt.deltaToChange<QuillFormat, Format>(
//                     state,
//                     delta,
//                     ocrdt.createQuillFormat(getStamp),
//                 );
//                 console.log('got local', delta, changes);
//                 // console.log('delta', delta);
//                 // console.log(changes);
//                 changes.forEach(change => {
//                     ocrdt.apply(state, change, mergeFormats);
//                 });
//                 onChange(changes);
//             },
//         );
//     },
//     applyChanges: (changes, doc, quill) => {
//         changes.forEach(change => {
//             const deltas = ocrdt.changeToDelta(doc, change, format =>
//                 ncrdt.value(format),
//             );
//             ocrdt.apply(doc, change, mergeFormats);
//             quill.updateContents(deltas, 'crdt');
//         });
//     },
// });
