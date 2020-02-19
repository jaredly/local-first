// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as debug from '../../packages/text-crdt/debug';

// const one = new Quill('#one', {
//     theme: 'snow',
// });
// const two = new Quill('#two', {
//     theme: 'snow',
// });

// const oneState = crdt.init('one');
// crdt.apply(oneState, delta, noop);
// const twoState = crdt.init('two');
// crdt.apply(twoState, delta, noop);

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
            // not changing
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
    // console.log(JSON.stringify(delta));
};

const changeToDelta = (state, change) => {
    switch (change.type) {
        case 'insert':
            console.log('insert at', change.span.after);
            const [id, site] = change.span.after;
            const pos = crdt.locToPos(state, { id, site, pre: true });
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
    span: { id: [2, 'root'], after: [0, 'root'], text: '\n' },
};

const addEditor = (name, broadcast, accept) => {
    const div = document.createElement('div');
    div.id = name;
    document.body.appendChild(div);
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
                        const asOne = changeToDelta(editors[id].state, change);
                        if (asOne) {
                            console.log(JSON.stringify(asOne));
                            editors[id].ui.updateContents(asOne, 'crdt');
                        } else {
                            console.error('Unable to convert back', change);
                        }
                        crdt.apply(editors[id].state, change, noop);
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

// two.on('text-change', function(delta, oldDelta, source) {
//     if (source === 'me') {
//         return;
//     }
//     console.log('changing', delta);
//     const changes = deltaToChange(twoState, delta.ops);
//     changes.forEach(change => {
//         crdt.apply(twoState, change, noop);
//         const asOne = changeToDelta(oneState, change);
//         if (asOne) {
//             console.log(JSON.stringify(asOne));
//             one.updateContents(asOne, 'me');
//         } else {
//             console.error('Unable to convert back', change);
//         }
//         crdt.apply(oneState, change, noop);
//     });
//     console.log(debug.toDebug(twoState));
//     console.log(JSON.stringify(two.getContents()));
// });

// one.on('text-change', function(delta, oldDelta, source) {
//     if (source === 'me') {
//         return;
//     }
//     console.log('New delta!', delta, source);
//     const changes = deltaToChange(oneState, delta.ops);
//     changes.forEach(change => {
//         console.log('one change', change);
//         crdt.apply(oneState, change, noop);
//     });
// });
