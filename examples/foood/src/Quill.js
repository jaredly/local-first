// @flow
import * as React from 'react';
import Quill from 'quill';
import deepEqual from '@birchill/json-equalish';
import { type QuillDelta } from '../../../packages/rich-text-crdt/quill-deltas';

var ListItem = Quill.import('formats/list/item');
var ListContainer = Quill.import('formats/list');
var Block = Quill.import('blots/block');

class IngredientListItem extends Block {
    // formatAt(index, length, name, value) {
    //     if (name === 'list') {
    //         // Allow changing or removing list format
    //         super.formatAt(name, value);
    //     }
    //     // Otherwise ignore
    // }
    // static value(node) {
    //     return 'yes-please';
    // }
}
IngredientListItem.tagName = 'li';
IngredientListItem.className = 'plain-list-item-folks';
IngredientListItem.blotName = 'ingredient';
IngredientListItem.requiredContainer = ListContainer;
ListContainer.allowedChildren.push(IngredientListItem);

Quill.register(IngredientListItem, true);

const keymap = (props: *, registry: *): * => ({
    // theme: false,
    theme: 'snow',
    // registry: registry,
    placeholder: ' ',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [
                { ingredient: true },
                // ok
                { list: 'bullet' },
                { list: 'checked' },
            ],
        ],
        // imageResize: {},
        // cursors: true,
        /* "mention": {
        "mentionDenotationChars": [|"/"|],
        "source":
          (. searchTerm: string, renderList, mentionChar: string) =>
            renderList(.
              [|
                {"id": 0, "value": "Header"},
                {"id": 1, "value": "Normal"},
                {"id": 2, "value": "Code"},
              |],
              searchTerm,
            ),
      }, */
        // return TRUE if the handler *fell through*. return FALSE if the handler succeeded, and bubbling should stop.
        keyboard: {
            bindings: {
                // collapse: {
                //     key: 'z',
                //     collapsed: true,
                //     altKey: true,
                //     handler: () => props.onToggleCollapse(),
                // },
                // 'collapse-mac': {
                //     key: `Ω`,
                //     collapsed: true,
                //     altKey: true,
                //     handler: () => props.onToggleCollapse(),
                // },
            },
        },
    },
});

const QuillEditor = ({
    value,
    onChange,
    // getStamp,
    // siteId,
    // innerRef,
    actions,
    className,
}: {
    value: Array<QuillDelta>,
    // innerRef: (node: ?{ focus: () => void }) => void,
    onChange: (Array<QuillDelta>) => mixed,
    // getStamp: () => string,
    // siteId: string,
    actions: *,
    className?: string,
}) => {
    const ref = React.useRef(null);
    const ui = React.useRef(null);

    const valueRef = React.useRef(value);
    if (ui.current && value !== valueRef.current) {
        const quill = ui.current;
        // const newContents = stateToQuillContents(value);
        const currentContents = quill.getContents().ops;
        if (!deepEqual(value, currentContents)) {
            console.log('new contents', value, currentContents);
            // const sel = quill.getSelection();
            // const pos = sel ? quillToTreePos(valueRef.current, sel) : null;
            quill.setContents(value, 'remote');
            // if (pos) {
            //     quill.setSelection(treeToQuillPos(value, pos));
            // }
        }
    }
    valueRef.current = value;

    React.useEffect(() => {
        // console.log(ref);
        const quill = (ui.current = new Quill(ref.current, keymap(actions)));
        // innerRef(quill);
        quill.setContents(value);
        // TODO: this focuses the editor automatically, which I don't want :/
        // I just want to prefill the selection to here, so that when it's "focus()"ed,
        // it doesn't select at the start. Might need to hack on quill to fix.
        // quill.setSelection(quill.getLength(), 0);

        quill.on('text-change', (delta: { ops: Array<QuillDelta> }, _oldDelta, source: string) => {
            if (source === 'remote') {
                return;
            }

            onChange(quill.getContents());
        });
        // return () => innerRef(null);
    }, []);

    return <div className={(className || '') + ' ql-container ql-bubble'} ref={ref} />;
};

export default QuillEditor;
