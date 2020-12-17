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
    const [value, setValue] = React.useState([
        {
            insert: `
My first attempt at a simple sweet rice dish using a steaming basket went like this:
Soak 2 cups of very short grain sweet rice (the package says apple brand sweet rice, and also "Qabkawg mov plaum" but I don't know if that's a brand or a description) in water for an hour to many hours.
Bring water to a boil in this cool vase-looking aluminum pot that Saem Gilcrest lent to me, and place the rice in a deep woven basket, so the basket is above the water. Keep water simmering and steam for about 18 minutes, occasionally tossing the rice in the basket so it rotates. 

Stir together with 
3 T. orange syrup from Candied Orange Zest
2 T. coconut cream powder
1/4-1/2 t. citric acid
pinch salt?
crushed pineapple would also be great, but I haven't tired that yet.

This fills a spot that a very much sweeter/fatter rice pudding might do; it's tasty, and not that unhealthy.
`,
        },
    ]);
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
                    // formatIngredients(quill, quill.getContents(), index, length);
                }}
            >
                Hello
            </button>
            <button
                onClick={() => {
                    const quill = quillRef.current;
                    if (!quill) return;
                    quill.format('measurement', false);
                }}
            >
                Undo
            </button>
            <QuillEditor
                value={value}
                onChange={(v) => setValue(v.ops)}
                actions={null}
                innerRef={quillRefGet}
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
