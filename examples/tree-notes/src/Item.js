// @flow
import * as React from 'react';
import { useCollection, useItem } from '../../../packages/client-react';
import { type Client } from '../../../packages/client-bundle';
import Quill from 'quill';
import {
    type QuillDelta,
    stateToQuillContents,
    quillDeltasToDeltas,
    treeToQuillPos,
    quillToTreePos,
} from '../../../packages/rich-text-crdt/quill-deltas';

const QuillEditor = ({ value, onChange, getStamp, siteId }) => {
    const ref = React.useRef(null);
    const ui = React.useRef(null);

    const valueRef = React.useRef(value);
    if (ui.current && value !== valueRef.current) {
        const quill = ui.current;
        const newContents = stateToQuillContents(value);
        const currentContents = quill.getContents();
        if (JSON.stringify(newContents) !== JSON.stringify(currentContents)) {
            const pos = quillToTreePos(valueRef.current, quill.getSelection());
            quill.setContents(newContents, 'crdt');
            quill.setSelection(treeToQuillPos(value, pos));
        }
    }
    valueRef.current = value;

    React.useEffect(() => {
        console.log(ref);
        const quill = (ui.current = new Quill(ref.current, { theme: 'bubble' }));
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
            onChange(newState);
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

const Item = ({ id, client }: { id: string, client: Client<*> }) => {
    const [col, item] = useItem(React, client, 'items', id);

    if (item === false) {
        return null; // loading
    }
    if (item == null) {
        return 'Item does not exist';
    }
    return (
        <div>
            <QuillEditor
                value={item.body}
                getStamp={client.getStamp}
                onChange={(body) => col.setAttribute(id, ['body'], body)}
                siteId={client.sessionId}
            />
        </div>
    );
};

export default Item;
