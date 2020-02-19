// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';

// import 'quill/dist/quill.snow.css';
const one = new Quill('#one', {
    theme: 'snow',
});
const two = new Quill('#two', {
    theme: 'snow',
});

const oneState = crdt.init('one');
const twoState = crdt.init('two');

const deltaToChange = (state, delta) => {
    if (delta.length === 2 && delta[0].retain && delta[1].insert) {
        return crdt.localInsert(state, delta[0].retain, delta[1].insert);
    }
    if (delta.length === 1 && delta[0].insert) {
        return crdt.localInsert(state, 0, delta[0].insert);
    }
    if (
        delta.length === 2 &&
        delta[0].retain &&
        delta[1].retain &&
        delta[1].attributes
    ) {
        return crdt.localFormat(
            state,
            delta[0].retain,
            delta[1].retain,
            delta[1].attributes,
        );
    }
    if (delta.length === 1 && delta[0].retain && delta[0].attributes) {
        return crdt.localFormat(state, 0, delta[0].retain, delta[0].attributes);
    }
    console.log(JSON.stringify(delta));
};

const changeToDelta = (state, change) => {
    switch (change.type) {
        case 'insert':
            console.log('insert at', change.span.after);
            const pos = crdt.textPositionForLoc(state, [change.span.after, 0]);
            if (pos === 0) {
                return [{ insert: change.span.text }];
            }
            return [
                { retain: pos },
                {
                    insert: change.span.text,
                    // attributes: change.span.format,
                },
            ];
        // Got to turn the spans into chunks of contiguousness, probs.
        // case 'format':
        //     const pos = crdt.textPositionForLoc(state, [change.span.after, 1]);
        //     if (pos === 0) {
        //         return [{ retain: pos, attributes: change.format }];
        //     }
        //     return [
        //         { retain: pos },
        //         {
        //             retain: change.positions,
        //             // attributes: change.span.format,
        //         },
        //     ];
    }
};

const noop = (a, b) => Object.assign({}, a, b);

const sent = [];

two.on('text-change', function(delta, oldDelta, source) {
    const change = deltaToChange(twoState, delta.ops);
    if (change) {
        console.log('change', change);
        crdt.apply(twoState, change, noop);
        const asOne = changeToDelta(oneState, change);
        sent.push(asOne);
        if (asOne) {
            console.log(JSON.stringify(asOne));
            one.updateContents(asOne, 'me');
        }
        // TODO make a "changeToDelta"
        crdt.apply(oneState, change, noop);
    }
    console.log(delta);
    console.log(crdt.toDebug(twoState));
    console.log(crdt.toDebug(oneState));
});

one.on('text-change', function(delta, oldDelta, source) {
    if (source === 'me') {
        return;
    }
    if (sent.indexOf(delta) !== -1) {
        console.log('seen it');
        return;
    }
    console.log('New delta!', delta, source);
    const change = deltaToChange(oneState, delta.ops);
    if (change) {
        console.log('one change', change);
        crdt.apply(oneState, change, noop);
    }
});
