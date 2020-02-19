// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as debug from '../../packages/text-crdt/debug';
import {
    deltaToChange,
    changeToDelta,
} from '../../packages/text-crdt/quill-deltas';

const editors = {};

const noop = (a, b) => Object.assign({}, a, b);
// Need initialDelta to match whata Quill expects
const initialDelta = {
    type: 'insert',
    span: { id: [0, '-initial-'], after: [0, crdt.rootSite], text: '\n' },
};

const addEditor = (name, broadcast, accept) => {
    const div = document.createElement('div');
    div.id = name;
    div.style.marginBottom = '12px';
    if (document.body) {
        document.body.appendChild(div);
    }
    editors[name] = {
        state: crdt.init(name),
        ui: new Quill(div, { theme: 'snow' }),
        broadcast,
        accept,
    };
    crdt.apply(editors[name].state, initialDelta, noop);

    editors[name].ui.on('text-change', (delta, oldDelta, source) => {
        if (source === 'crdt') {
            return;
        }
        const changes = deltaToChange(editors[name].state, delta);
        console.log('changes', JSON.stringify(changes));
        changes.forEach(change => {
            crdt.apply(editors[name].state, change, noop);
        });
        if (broadcast) {
            changes.forEach(change => {
                Object.keys(editors).forEach(id => {
                    if (id !== name && editors[id].accept) {
                        crdt.apply(editors[id].state, change, noop);
                        const deltas = changeToDelta(editors[id].state, change);
                        editors[id].ui.updateContents(deltas, 'crdt');
                        console.log(crdt.toString(editors[id].state));
                    }
                });
            });
        }
    });
};

addEditor('one', true, true);
addEditor('two', true, true);
addEditor('three', false, true);
addEditor('four', true, false);
