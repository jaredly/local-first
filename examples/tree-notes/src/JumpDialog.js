// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { useHistory, Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { toString as richTextToString } from '../../../packages/rich-text-crdt';

import Dialog from '@material-ui/core/Dialog';
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

const useChanges = (url, id, count) => {
    const params = useParams();
    const [data, setData] = React.useState(null);
    const authData = React.useContext(AuthContext);
    React.useEffect(() => {
        if (!authData || !authData.auth) {
            return;
        }
        fetch(
            `${
                url.startsWith('localhost:') ? 'http' : 'https'
            }://${url}/changes?count=${count}&db=trees/${
                params.doc
            }&collection=items&id=${id}&token=${authData.auth.token}`,
        )
            .then((res) => res.json())
            .then((data) => {
                console.log('got it');
                console.log(data);
                setData(data);
            });
    }, [authData ? authData.auth : null]);
    return data;
};

const SingleItem = ({ id, client }) => {
    const [col, item] = useItem<ItemT, _>(React, client, 'items', id);
    if (!item) {
        return null;
    }
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ padding: '4px 8px' }}>{richTextToString(item.body)}</div>
        </div>
    );
};

const ItemPreview = ({ item, client, onMenu }) => {
    const [col, items] = useItems<ItemT, _>(React, client, 'items', item.children);
    if (items == null) {
        return <div />;
    }
    return (
        <div style={{ marginBottom: 8, position: 'relative' }}>
            <div style={{ padding: '4px 8px' }}>{richTextToString(item.body)}</div>
            <div style={{ marginLeft: 20 }}>
                {item.children.map((id) => (
                    <div key={id} style={{ padding: '4px 8px' }}>
                        {items[id] ? richTextToString(items[id].body) : 'Not found'}
                    </div>
                ))}
            </div>
            <IconButton
                style={{ position: 'absolute', top: 0, right: 0 }}
                color="inherit"
                onClick={(evt) => {
                    onMenu(evt.currentTarget);
                }}
            >
                <MoreHoriz />
            </IconButton>
        </div>
    );
};

const findResets = (node, changes) => {
    const summary = {
        initial: node,
        resets: [],
        final: null,
        addedChildren: {},
    };
    let current = node;
    changes.forEach((change, i) => {
        if (
            change.type === 'insert' &&
            change.path.length === 2 &&
            change.path[0].key === 'children'
        ) {
            summary.addedChildren[change.value.value] = true;
        }
        if (change.type === 'set' && change.path.length === 0 && current != null) {
            summary.resets.push(current);
        }
        current = clientCrdtImpl.deltas.apply(current, change);
    });
    summary.final = current;
    return summary;
};

const Changes = ({ id, node, changes, by, client, col }) => {
    const summary = findResets(node, changes);

    const latest = summary.final ? clientCrdtImpl.value(summary.final) : null;
    const removedChildren = Object.keys(summary.addedChildren).filter((k) =>
        latest ? !latest.children.includes(k) : true,
    );
    const [menu, setMenu] = React.useState(null);

    return (
        <div style={{ padding: 8 }}>
            {summary.resets.length > 0 ? (
                <React.Fragment>
                    <h3>Node Resets</h3>
                    {summary.resets.map((node, i) => (
                        <ItemPreview
                            onMenu={(anchor) => setMenu({ node, anchor })}
                            client={client}
                            item={clientCrdtImpl.value(node)}
                            key={i}
                        />
                    ))}
                </React.Fragment>
            ) : null}
            {removedChildren.length > 0 ? (
                <React.Fragment>
                    <h3>Removed Children</h3>
                    {removedChildren.map((key) => (
                        <SingleItem client={client} id={key} key={key} />
                    ))}
                </React.Fragment>
            ) : null}
            <Menu
                anchorEl={menu ? menu.anchor : null}
                open={Boolean(menu)}
                onClose={() => setMenu(null)}
            >
                <MenuItem
                    onClick={() => {
                        if (menu) {
                            // col.setAttribute(id, ['about', 'image'], anchor.src);
                            // setAnchor(null);
                            // Ok not actually sure what I want to do there.
                        }
                    }}
                >
                    Restore body text
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menu) {
                            addAllChildren(col, id, clientCrdtImpl.value(menu.node).children);
                            // let last = null
                            // col.setAttribute(id, ['about', 'image'], anchor.src);
                            // setAnchor(null);
                        }
                    }}
                >
                    Restore all children
                </MenuItem>
            </Menu>
        </div>
    );
};

const addAllChildren = async (col, id, children) => {
    const current = await col.load(id);
    if (!current) {
        return;
    }
    let last = current.children[current.children.length - 1];
    for (const key of children) {
        if (last != null) {
            await col.insertIdRelative(id, ['children'], key, last, false);
        } else {
            await col.insertId(id, ['children'], 0, key);
            last = key;
        }
    }
};

const JumpDialog = ({ onClose, col, url, client }: *) => {
    // const data = useChanges(url, id, 5000);
    return (
        <Dialog open={true} onClose={onClose}>
            <DialogTitle>Jump to...</DialogTitle>
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
        </Dialog>
    );
};

export default JumpDialog;
