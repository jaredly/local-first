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
            `http://localhost:9090/changes?count=${count}&db=trees/${params.doc}&collection=items&id=${id}&token=${authData.auth.token}`,
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

const ItemPreview = ({ item, client }) => {
    const [col, items] = useItems<ItemT, _>(React, client, 'items', item.children);
    if (items == null) {
        return <div />;
    }
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ padding: '4px 8px' }}>{richTextToString(item.body)}</div>
            <div style={{ marginLeft: 20 }}>
                {item.children.map((id) => (
                    <div key={id} style={{ padding: '4px 8px' }}>
                        {items[id] ? richTextToString(items[id].body) : 'Not found'}
                    </div>
                ))}
            </div>
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

const Changes = ({ node, changes, by, client }) => {
    const summary = findResets(node, changes);

    // const nodes = [];
    // let current = node;
    // if (current != null) {
    //     nodes.push(current);
    // }
    // changes.forEach((change, i) => {
    //     if (change.type === 'set' && change.path.length === 0 && current != null) {
    //         nodes.push(current);
    //     }
    //     current = clientCrdtImpl.deltas.apply(current, change);
    // });
    // nodes.push(current);
    const latest = summary.final ? clientCrdtImpl.value(summary.final) : null;
    const removedChildren = Object.keys(summary.addedChildren).filter((k) =>
        latest ? !latest.children.includes(k) : true,
    );

    if (summary.resets.length) {
        return (
            <div style={{ padding: 8 }}>
                {summary.resets.length > 0 ? (
                    <React.Fragment>
                        <h3>Node Resets</h3>
                        {summary.resets.map((node, i) => (
                            <ItemPreview
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
            </div>
        );
    }

    // const

    return (
        <div style={{ padding: 8 }}>
            <h3>Children Removed</h3>
        </div>
    );
};

const ChangesDialog = ({ client, id, col, url, onClose }: *) => {
    // client.persistence.crdt;
    const data = useChanges(url, id, 1000);
    return (
        <Dialog open={true} onClose={onClose}>
            <DialogTitle>Changes History</DialogTitle>
            {data ? (
                <Changes client={client} node={data.node} by={50} changes={data.changes} />
            ) : (
                'loading...'
            )}
        </Dialog>
    );
};

export default ChangesDialog;
