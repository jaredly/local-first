import * as Y from 'yjs';
import {
    ySyncPlugin,
    yCursorPlugin,
    yUndoPlugin,
    undo,
    redo,
} from 'y-prosemirror';
import * as ncrdt from '../../packages/nested-object-crdt';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from './schema.js';
import { exampleSetup } from 'prosemirror-example-setup';
import { keymap } from 'prosemirror-keymap';
import { createChart } from './chart';

window.addEventListener('load', () => {
    const ydoc = new Y.Doc();
    ydoc.clientID = 0;
    const type = ydoc.getXmlFragment('prosemirror');
    ydoc.on('update', () => {
        chart.render(toData(type));
    });

    const nodeToTree = (node, parent, map) => {
        const res = {
            id: [node.id.clock, node.id.client],
            parent,
            text: '----',
            deleted: node.deleted,
            format: null,
            children: [],
            size: 0,
        };
        const key = `${node.id.clock}:${node.id.client}`;
        map[key] = res;
        if (node.content.type) {
            res.text = node.content.type.nodeName || '<text>';
            let current = node.content.type._start;
            while (current) {
                res.children.push(nodeToTree(current, key, map));
                current = current.right;
            }
        } else if (node.content.str) {
            res.text = node.content.str;
        } else if (node.content.key) {
            res.text = node.content.key;
            if (!node.content.value) {
                res.text = '/' + node.content.key;
            }
            res.format = ncrdt.createDeepMap(
                { [node.content.key]: node.content.value },
                '',
            );
        } else {
            console.log('nop', node.content);
        }
        return res;
    };

    const toData = doc => {
        const data = {
            site: ydoc.clientID,
            largestLocalId: 0,
            roots: [],
            map: { '0:-root-': { text: '' } },
        };
        let node = doc._start;
        while (node) {
            data.roots.push(nodeToTree(node, null, data.map));
            node = node.right;
        }
        console.log(data);
        return data;
    };
    window.toData = toData;

    const editor = document.createElement('div');
    editor.setAttribute('id', 'editor');
    const editorContainer = document.createElement('div');
    editorContainer.insertBefore(editor, null);
    const prosemirrorView = new EditorView(editor, {
        state: EditorState.create({
            schema,
            plugins: [
                ySyncPlugin(type),
                yUndoPlugin(),
                keymap({
                    'Mod-z': undo,
                    'Mod-y': redo,
                    'Mod-Shift-z': redo,
                }),
            ].concat(exampleSetup({ schema })),
        }),
    });
    document.body.insertBefore(editorContainer, null);

    const chart = createChart();
    document.body.appendChild(chart.node);

    const connectBtn = /** @type {HTMLElement} */ (document.getElementById(
        'y-connect-btn',
    ));

    // @ts-ignore
    window.example = { ydoc, type, prosemirrorView, chart };
});
