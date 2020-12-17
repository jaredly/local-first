// @flow
import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
import QuillEditor from './Quill';

const RecipeEditor = () => {
    const [value, setValue] = React.useState([]);
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
                    console.log(quill.getSelection());
                    console.log(quill.getContents());
                    console.log(quill.getFormat());
                }}
            >
                Hello
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
