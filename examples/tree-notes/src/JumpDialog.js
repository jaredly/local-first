// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { useHistory, Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { toString as richTextToString } from '../../../packages/rich-text-crdt';

import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import DialogTitle from '@material-ui/core/DialogTitle';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
import MoreHoriz from '@material-ui/icons/MoreHoriz';
import querystring from 'querystring';
import ListItem from '@material-ui/core/ListItem';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import * as React from 'react';
import Checkbox from '@material-ui/core/Checkbox';

import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
    createInMemoryEphemeralClient,
    clientCrdtImpl,
} from '../../../packages/client-bundle';
import { useCollection, useItem, useItems } from '../../../packages/client-react';
import { type Client, type SyncStatus, type Collection } from '../../../packages/client-bundle';
import type { Data } from '../../shared/auth-api';
import { type AuthData, useAuthStatus, AuthContext } from '../../shared/Auth';

import LocalClient from './LocalClient';
import Item from './Item';
import { type DropTarget } from './dragging';
import { setupDragListeners, type DragInit, type DragState } from './dragging';
import type { ItemT } from '../collections';

const reach = (items, result, node, path) => {
    if (result[node.id]) {
        return;
    }
    const childPath = path.concat([node.id]);
    result[node.id] = { id: node.id, node, path: childPath };
    node.children.forEach((id) => {
        if (items[id]) {
            reach(items, result, items[id], childPath);
        }
    });
};

export const Jump = ({ url, client, onClose }: *) => {
    const history = useHistory();
    const params = useParams();
    const [col, items] = useCollection(React, client, 'items');
    const [searchText, setText] = React.useState('');
    const [selected, setSelected] = React.useState(0);
    const needle = searchText.toLowerCase();
    const reachable: Array<{ node: ItemT, id: string, path: Array<string> }> = React.useMemo(() => {
        const root = items.root;
        if (!root) {
            return [];
        }
        const result = {};
        reach(items, result, root, []);
        return Object.keys(result).map((id) => result[id]);
    }, [items]);
    let toShow = reachable.map(({ node, id, path }) => ({
        id: node.id,
        body: richTextToString(node.body),
        path,
    }));
    if (needle.length >= 2) {
        toShow = toShow
            .filter(({ body }) =>
                body.trim() !== ''
                    ? needle.length >= 2
                        ? body.toLowerCase().includes(needle)
                        : true
                    : false,
            )
            .sort((a, b) => a.body.length - b.body.length);
    }

    return (
        <React.Fragment>
            <TextField
                fullWidth
                variant="outlined"
                label="Search"
                autoFocus
                placeholder="Search text"
                value={searchText}
                onChange={(evt) => setText(evt.target.value)}
                onKeyDown={(evt) => {
                    if (evt.key === 'ArrowDown') {
                        setSelected(selected + 1);
                    }
                    if (evt.key === 'Down') {
                        setSelected(selected + 1);
                    }
                    if (evt.key === 'ArrowUp') {
                        setSelected(selected - 1);
                    }
                    if (evt.key === 'Up') {
                        setSelected(selected - 1);
                    }
                    console.log(evt.key);
                    if (evt.key === 'Enter') {
                        const sel = toShow[selected];
                        if (sel) {
                            history.push(`/doc/${params.doc}/item/${sel.path.join(':-:')}`);
                            onClose();
                        }
                    }
                }}
            />
            <div style={{ flex: 1, overflow: 'auto' }}>
                {toShow.slice(0, 100).map(({ id, body, path }, i) => (
                    <div
                        key={id}
                        style={i === selected ? { backgroundColor: '#666' } : null}
                        css={{ padding: '4px 8px' }}
                        onClick={() => {
                            history.push(`/doc/${params.doc}/item/${path.join(':-:')}`);
                            onClose();
                        }}
                    >
                        {body}
                    </div>
                ))}
            </div>
            {/* {data ? (
                <Changes
                    id={id}
                    col={col}
                    client={client}
                    node={data.node}
                    by={50}
                    changes={data.changes}
                />
            ) : (
                'loading...'
            )} */}
        </React.Fragment>
    );
};

const JumpDialog = ({ onClose, url, client }: *) => {
    return (
        <Dialog open={true} onClose={onClose}>
            <div
                css={{
                    width: 500,
                    maxWidth: '80vw',
                    height: 600,
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 16,
                }}
            >
                <DialogTitle>Jump to...</DialogTitle>
                <Jump onClose={onClose} url={url} client={client} />
            </div>
        </Dialog>
    );
};

export default JumpDialog;
