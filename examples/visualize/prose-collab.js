import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import * as collab from 'prosemirror-collab';
import { exampleSetup } from 'prosemirror-example-setup';

function collabEditor(place) {
    let view = new EditorView(place, {
        state: EditorState.create({
            schema,
            //   doc: authority.doc,
            plugins: [collab.collab({ version: 0 })].concat(
                exampleSetup({ schema }),
            ),
        }),
        dispatchTransaction(transaction) {
            let newState = view.state.apply(transaction);
            view.updateState(newState);
            let sendable = collab.sendableSteps(newState);
            if (sendable) console.log(sendable);
            // authority.receiveSteps(sendable.version, sendable.steps,
            //                        sendable.clientID)
        },
    });

    //   authority.onNewSteps.push(function() {
    //     let newData = authority.stepsSince(collab.getVersion(view.state))
    //     view.dispatch(
    //       collab.receiveTransaction(view.state, newData.steps, newData.clientIDs))
    //   })

    return view;
}

const editorContainer = document.createElement('div');
document.body.appendChild(editorContainer);
collabEditor(editorContainer);
