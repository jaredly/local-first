// @flow
import * as React from 'react';
import Quill from 'quill';
import {
    type QuillDelta,
    stateToQuillContents,
    quillDeltasToDeltas,
    treeToQuillPos,
    quillToTreePos,
} from '../../../packages/rich-text-crdt/quill-deltas';
import { type CRDT, type Delta } from '../../../packages/rich-text-crdt';
import deepEqual from '@birchill/json-equalish';
import keymap from './QuillKeyMap';

// let atLeft = quill => {
//   let sel = getSelection(quill);
//   switch (Js.toOption(sel)) {
//   | None => false
//   | Some(sel) =>
//     View.Range.indexGet(sel) == 0. && View.Range.lengthGet(sel) == 0.
//   };
// };

// let atRight = quill => {
//   let sel = getSelection(quill);
//   switch (Js.toOption(sel)) {
//   | None => false
//   | Some(sel) =>
//     View.Range.lengthGet(sel) == 0.
//     && View.Range.indexGet(sel) == getLength(quill)
//     -. 1.
//   };
// };

// let atTop = quill => {
//   let sel = getSelection(quill);
//   switch (Js.toOption(sel)) {
//   | None => false
//   | Some(sel) =>
//     View.Range.lengthGet(sel) == 0.
//     &&
//     getBounds(quill, View.Range.indexGet(sel))##top ==
//     getBounds(quill, 0.)##top
//   };
// };

// let atBottom = quill => {
//   let sel = getSelection(quill);
//   switch (Js.toOption(sel)) {
//   | None => false
//   | Some(sel) =>
//     View.Range.lengthGet(sel) == 0.
//     &&
//     getBounds(quill, View.Range.indexGet(sel))##top ==
//     getBounds(quill, getLength(quill))##top
//   };
// };

const QuillEditor = ({
    value,
    onChange,
    getStamp,
    siteId,
}: {
    value: CRDT,
    onChange: (Array<Delta>) => mixed,
    getStamp: () => string,
    siteId: string,
}) => {
    const ref = React.useRef(null);
    const ui = React.useRef(null);

    const valueRef = React.useRef(value);
    if (ui.current && value !== valueRef.current) {
        const quill = ui.current;
        const newContents = stateToQuillContents(value);
        const currentContents = quill.getContents();
        if (!deepEqual(newContents.ops, currentContents.ops)) {
            console.log('new contents', newContents, currentContents, value, valueRef.current);
            const sel = quill.getSelection();
            const pos = sel ? quillToTreePos(valueRef.current, quill.getSelection()) : null;
            quill.setContents(newContents, 'crdt');
            if (pos) {
                quill.setSelection(treeToQuillPos(value, pos));
            }
        }
    }
    valueRef.current = value;

    React.useEffect(() => {
        console.log(ref);
        const quill = (ui.current = new Quill(
            ref.current,
            keymap({
                onUp() {},
                onDown() {
                    console.log('down');
                },
            }),
        ));
        quill.setContents(stateToQuillContents(value));

        quill.on('text-change', (delta: { ops: Array<QuillDelta> }, _oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            console.log(delta);

            const { state: newState, deltas } = quillDeltasToDeltas(
                valueRef.current,
                siteId,
                delta.ops,
                getStamp,
            );
            onChange(deltas);
            // receiving somewhere else I guess
            // const { state: newState2, quillDeltas } = deltasToQuillDeltas(
            //     altState,
            //     deltas,
            // );
            // console.log('transformed deltas', deltas, quillDeltas);
            // window.altState = altState = newState2;
            // quillDeltas.forEach(delta => {
            //     altUi.updateContents(delta, 'crdt');
            // });
        });
    }, []);

    return <div ref={ref} />;
};

export default QuillEditor;
