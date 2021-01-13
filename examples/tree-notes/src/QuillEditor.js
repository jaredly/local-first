// @flow
import * as React from 'react';
import Quill from 'quill/dist/quill.prod.js';
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

const QuillEditor = ({
    value,
    onChange,
    getStamp,
    siteId,
    innerRef,
    actions,
    className,
}: {
    value: CRDT,
    innerRef: (node: ?{ focus: () => void }) => void,
    onChange: (Array<Delta>) => mixed,
    getStamp: () => string,
    siteId: string,
    actions: *,
    className?: string,
}) => {
    const ref = React.useRef(null);
    const ui = React.useRef(null);

    const valueRef = React.useRef(value);
    if (ui.current && value !== valueRef.current) {
        const quill = ui.current;
        const newContents = stateToQuillContents(value);
        const currentContents = quill.getContents();
        if (!deepEqual(newContents.ops, currentContents.ops)) {
            // console.log('new contents', newContents, currentContents, value, valueRef.current);
            const sel = quill.getSelection();
            const pos = sel ? quillToTreePos(valueRef.current, sel) : null;
            quill.setContents(newContents, 'crdt');
            if (pos) {
                quill.setSelection(treeToQuillPos(value, pos));
            }
        }
    }
    valueRef.current = value;

    React.useEffect(() => {
        // console.log(ref);
        const quill = (ui.current = new Quill(ref.current, keymap(actions)));
        innerRef(quill);
        quill.setContents(stateToQuillContents(value));
        // TODO: this focuses the editor automatically, which I don't want :/
        // I just want to prefill the selection to here, so that when it's "focus()"ed,
        // it doesn't select at the start. Might need to hack on quill to fix.
        // quill.setSelection(quill.getLength(), 0);

        quill.on('text-change', (delta: { ops: Array<QuillDelta> }, _oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            // console.log(crdt.text)

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
        return () => innerRef(null);
    }, []);

    return <div className={(className || '') + ' ql-container ql-bubble'} ref={ref} />;
};

export default QuillEditor;
