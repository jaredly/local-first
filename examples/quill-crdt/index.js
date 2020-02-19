// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as debug from '../../packages/text-crdt/debug';

const deltaToChange = (state, delta) => {
    const changes = [];
    let pos = 0;
    delta.forEach(op => {
        if (op.delete) {
            changes.push(crdt.localDelete(state, pos, op.delete));
            pos += op.delete;
        } else if (op.insert) {
            changes.push(
                crdt.localInsert(state, pos, op.insert, op.attributes),
            );
        } else if (op.retain) {
            if (op.attributes) {
                changes.push(
                    crdt.localFormat(state, pos, op.retain, op.attributes),
                );
            }
            pos += op.retain;
        }
    });
    return changes;
};

const changeToDelta = (state, change) => {
    switch (change.type) {
        case 'insert':
            const [id, site] = change.span.id;
            const pos = crdt.locToPos(state, { id, site, pre: false });
            console.log(id, site, pos);
            if (pos === 0) {
                return [{ insert: change.span.text }];
            }
            return [
                { retain: pos },
                {
                    insert: change.span.text,
                    attributes: change.span.format,
                },
            ];
        case 'format':
            const selections = crdt.spansToSelections(state, change.positions);
            let current = 0;
            const res = [];
            selections.forEach(selection => {
                if (selection.start !== current) {
                    res.push({ retain: selection.start - current });
                }
                current += selection.end - selection.start;
                res.push({
                    retain: selection.end - selection.start,
                    attributes: change.format,
                });
            });
            return res;
        case 'delete':
            return deleteToDeltas(state, change.positions);
    }
};

const deleteToDeltas = (state, positions) => {
    const selections = crdt.spansToSelections(state, positions);
    let current = 0;
    const res = [];
    selections.forEach(selection => {
        if (selection.start !== current) {
            res.push({ retain: selection.start - current });
        }
        current += selection.end - selection.start;
        res.push({
            delete: selection.end - selection.start,
        });
    });
    return res;
};

const editors = {};

const noop = (a, b) => Object.assign({}, a, b);
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
        if (broadcast) {
            changes.forEach(change => {
                crdt.apply(editors[name].state, change, noop);
                Object.keys(editors).forEach(id => {
                    if (id !== name && editors[id].accept) {
                        crdt.apply(editors[id].state, change, noop);
                        const asOne = changeToDelta(editors[id].state, change);
                        if (asOne) {
                            console.log(JSON.stringify(asOne));
                            editors[id].ui.updateContents(asOne, 'crdt');
                        } else {
                            console.error('Unable to convert back', change);
                        }
                        console.log(crdt.toString(editors[id].state));
                    }
                });
            });
        } else {
            changes.forEach(change => {
                crdt.apply(editors[name].state, change, noop);
            });
        }
    });
};

addEditor('one', true, true);
addEditor('two', true, true);
addEditor('three', false, true);
addEditor('four', true, false);
