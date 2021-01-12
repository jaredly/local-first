// @flow
import { node, div, span, addDiv } from './node';
import Quill from 'quill';
import QuillCursors from 'quill-cursors/dist/index.js';
// $FlowFixMe
import * as Y from 'yjs';
Quill.register('modules/cursors', QuillCursors);
import { QuillBinding } from 'y-quill';

let syncing = false;
const syncButtons = [];
const toggleSync = () => {
    syncButtons.forEach(button => {
        if (syncing) {
            button.textContent = 'Disconnected';
        } else {
            button.textContent = 'Connected';
        }
    });
    if (syncing) {
        syncing = false;
    } else {
        syncing = true;
        all.forEach(ed => ed.sync());
    }
};

const make = function<T, Change>(
    name,
    crdt: {
        init: string => T,
        applyChanges: (Array<Change>, T, Quill) => void,
        connect: (T, Quill, (Change) => void) => void,
    },
): { ui1: Quill, ui2: Quill, sync: () => void } {
    const ui1div = div();
    const ui2div = div();
    const button = node('button', { onclick: toggleSync }, ['Disconnected']);
    syncButtons.push(button);
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
    return { ui1, ui2, sync };
};

const all = [];

import * as ocrdt from '../../packages/text-crdt/tree';
import * as ncrdt from '../../packages/nested-object-crdt';
import {
    deltaToChange,
    changeToDelta,
    initialDelta,
    type QuillDelta,
} from '../../packages/text-crdt/quill-deltas';
import * as hlc from '../../packages/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';

const mergeFormats = (one: any, two: any): any => ncrdt.merge(one, two);

const createQuillFormat = getStamp => (quillFormat, preFormat, postFormat) => {
    if (preFormat && matchesFormat(preFormat, quillFormat)) {
        return preFormat;
    }
    if (postFormat && matchesFormat(postFormat, quillFormat)) {
        return postFormat;
    }
    return ncrdt.createDeepMap(quillFormat, getStamp());
};

const matchesFormat = (format, quill) => {
    return !Object.keys(quill).some(key => {
        return !format.map[key] || !deepEqual(ncrdt.value(format.map[key]), quill[key]);
    });
};

import * as crdt from '../../packages/rich-text-crdt';
import {
    quillDeltasToDeltas,
    deltasToQuillDeltas,
    stateToQuillContents,
    initialQuillDelta,
} from '../../packages/rich-text-crdt/quill-deltas';

all.push(
    make('Mine (new)', {
        init: id => {
            let state = crdt.init();
            state = crdt.apply(state, initialQuillDelta);
            let clock = hlc.init(id, Date.now());
            const getStamp = () => {
                const next = hlc.inc(clock, Date.now());
                clock = next;
                return hlc.pack(next);
            };

            return { state, getStamp };
        },
        connect: (state, quill, onChange) => {
            quill.on('text-change', (delta, oldDelta, source) => {
                if (source === 'crdt') {
                    return;
                }
                const { state: nw, deltas: changes } = quillDeltasToDeltas(
                    state.state,
                    'site',
                    delta,
                    state.getStamp,
                );
                console.log('got local', delta, changes);
                state.state = nw;
                // changes.forEach(change => {
                //     state.state = crdt.apply(state.state, change);
                // });
                onChange(changes);
            });
        },
        applyChanges: (changes, doc, quill) => {
            const { state, quillDeltas } = deltasToQuillDeltas(doc.state, changes);
            quillDeltas.forEach(delta => {
                quill.updateContents(delta, 'crdt');
            });
            doc.state = state;
        },
    }),
);

all.push(
    make('Mine (old)', {
        init: id => {
            const state = ocrdt.init(id);
            ocrdt.apply(state, initialDelta, mergeFormats);
            let clock = hlc.init(id, Date.now());
            const getStamp = () => {
                const next = hlc.inc(clock, Date.now());
                clock = next;
                return hlc.pack(next);
            };

            return { state, getStamp };
        },
        connect: (state, quill, onChange) => {
            quill.on('text-change', (delta, oldDelta, source) => {
                if (source === 'crdt') {
                    return;
                }
                const changes = deltaToChange(
                    state.state,
                    delta,
                    createQuillFormat(state.getStamp),
                );
                console.log('got local', delta, changes);
                // console.log('delta', delta);
                // console.log(changes);
                changes.forEach(change => {
                    ocrdt.apply(state.state, change, mergeFormats);
                });
                onChange(changes);
            });
        },
        applyChanges: (changes, doc, quill) => {
            [].concat(...changes).forEach(change => {
                const deltas = changeToDelta(doc.state, change, format => ncrdt.value(format));
                ocrdt.apply(doc.state, change, mergeFormats);
                quill.updateContents(deltas, 'crdt');
            });
        },
    }),
);

all.push(
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
    }),
);

all.forEach((editors, i) => {
    editors.ui1.on('text-change', (delta, _, source) => {
        if (source !== 'yjs' && source !== 'crdt' && source !== 'api') {
            all.forEach((e, i2) => {
                if (i !== i2) {
                    e.ui1.updateContents(delta, 'api');
                }
            });
        }
    });
    editors.ui2.on('text-change', (delta, _, source) => {
        if (source !== 'yjs' && source !== 'crdt' && source !== 'api') {
            all.forEach((e, i2) => {
                if (i !== i2) {
                    e.ui2.updateContents(delta, 'api');
                }
            });
        }
    });
});
