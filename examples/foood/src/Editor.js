// @flow
import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
import QuillEditor from './Quill';
import { parse } from './parse';

// TODO: this will happen automatically on rendering, as we can be pretty sure of its accuracy.
const formatIngredients = (quill, contents, index, length) => {
    let at = 0;
    contents.ops.forEach((item) => {
        if (at >= index + length) {
            return;
        }
        if (item.insert === '\n') {
            at += 1;
            return;
        }
        const lines = item.insert.split('\n');
        if (!lines.length) {
            return;
        }
        lines.forEach((line) => {
            if (at + line.length >= index && at < index + length) {
                parse(line).forEach((found) => {
                    console.log(found);
                    quill.formatText(
                        at + found.offset,
                        found.match.length,
                        'measurement',
                        found.groups,
                        'api',
                    );
                });
            }
            at += line.length + 1;
        });
        at -= 1; // to account for the last \n which is separate
    });
    console.log('ok', contents, index, length);
    // ok, so what are we up to?
    // When formatting as "ingredients"
    // first do the quil line format
    // then find the bounds of all the lines that are ingredients
    // then search those bounds, identifying amounts (incl units) and ingredient names.
};

const RecipeEditor = () => {
    const [value, setValue] = React.useState([{ insert: `\n` }]);
    const quillRef = React.useRef(null);
    const quillRefGet = React.useCallback((node) => {
        quillRef.current = node;
    }, []);
    return (
        <div>
            dare to edit
            <button
                onClick={() => {
                    const quill = quillRef.current;
                    if (!quill) return;
                    const { index, length } = quill.getSelection();
                    if (quill.getFormat().ingredient === true) {
                        quill.formatLine(index, length, 'ingredient', false, 'user');
                        return;
                    }
                    quill.formatLine(index, length, 'ingredient', true, 'user');
                }}
            >
                Ingredients
            </button>
            <button
                onClick={() => {
                    const quill = quillRef.current;
                    if (!quill) return;
                    const { index, length } = quill.getSelection();
                    if (quill.getFormat().instruction === true) {
                        quill.formatLine(index, length, 'instruction', false, 'user');
                        return;
                    }
                    quill.formatLine(index, length, 'instruction', true, 'user');
                }}
            >
                Instructions
            </button>
            <QuillEditor
                value={value}
                onChange={(v) => setValue(v.ops)}
                actions={null}
                innerRef={quillRefGet}
                config={quillConfig}
                // getStamp,
                // siteId,
                // actions,
                // className,
            />
            <textarea
                value={JSON.stringify(value, null, 2)}
                onChange={(evt) => {
                    setValue(JSON.parse(evt.target.value));
                }}
            />
        </div>
    );
};

const quillConfig = {
    theme: 'snow',
    placeholder: 'Paste or type recipe here...',
    modules: {
        toolbar: [['bold', 'italic', 'underline', 'strike', 'link'], [{ list: 'bullet' }]],
        keyboard: {
            bindings: {
                backspace: {
                    key: 8,
                    collapsed: true,
                    handler() {
                        const format = this.quill.getFormat();
                        const sel = this.quill.getSelection();
                        const raw = this.quill.getText();
                        if (raw[sel.index - 1] === '\n' || sel.index === 0) {
                            if (format.instruction) {
                                this.quill.formatLine(sel.index, sel.length, 'instruction', false);
                                return false;
                            }
                            if (format.ingredient) {
                                this.quill.formatLine(sel.index, sel.length, 'ingredient', false);
                                return false;
                            }
                        }
                        // console.log(format, sel, [raw.slice(sel.index), raw[sel.index - 1]]);
                        return true;
                    },
                },
                enter: {
                    key: 'Enter',
                    collapsed: true,
                    handler() {
                        const format = this.quill.getFormat();
                        const sel = this.quill.getSelection();
                        const raw = this.quill.getText();
                        if (
                            raw[sel.index - 1] === '\n' &&
                            (raw[sel.index] === '\n' || sel.index === raw.length)
                        ) {
                            if (format.instruction) {
                                this.quill.formatLine(sel.index, sel.length, 'instruction', false);
                                return false;
                            }
                            if (format.ingredient) {
                                this.quill.formatLine(sel.index, sel.length, 'ingredient', false);
                                return false;
                            }
                        }
                        return true;
                    },
                },
            },
        },
    },
};

export default RecipeEditor;

// import querystring from 'querystring';
// import ListItem from '@material-ui/core/ListItem';
// import Switch from '@material-ui/core/Switch';
// import FormControlLabel from '@material-ui/core/FormControlLabel';
// import * as React from 'react';
// import {
//     createPersistedBlobClient,
//     createPersistedDeltaClient,
//     createPollingPersistedDeltaClient,
//     createInMemoryDeltaClient,
//     createInMemoryEphemeralClient,
// } from '../../../packages/client-bundle';
// import { useCollection, useItem } from '../../../packages/client-react';
// import type { Data } from '../../shared/auth-api';
// import type { AuthData } from '../../shared/Auth';

// import schemas from '../collections';
// import AppShell from '../../shared/AppShell';
// import Drawer from './Drawer';
// import UpdateSnackbar from '../../shared/Update';
// // import Items from './Items';

// import { Switch as RouteSwitch } from 'react-router-dom';
