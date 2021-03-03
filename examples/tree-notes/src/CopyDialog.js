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

const getDeep = async (col: Collection<ItemT>, id) => {
    const item = await col.load(id);
    if (!item) {
        return null;
    }
    const children = await Promise.all(item.children.map((id) => getDeep(col, id)));
    return { item, children };
};

const useTree = (col, id) => {
    const [data, setData] = React.useState(null);
    React.useEffect(() => {
        getDeep(col, id).then((data) => setData(data));
    }, [id]);
    return data;
};

const dataToText = (data, config) => {
    let lines = [];
    if (!config.skipHeader) {
        lines.push(richTextToString(data.item.body));
    }
    for (let child of data.children) {
        if (child) {
            lines.push(...dataToText(child, { ...config, skipHeader: false }));
        }
    }

    return lines;
};

const CopyDialog = ({ client, id, col, url, onClose }: *) => {
    const data = useTree(col, id);
    const [config, setConfig] = React.useState({ spaces: false, skipHeader: false });
    const text = data ? dataToText(data, config).join(config.spaces ? '\n' : '') : 'Loading...';
    return (
        <Dialog open={true} onClose={onClose}>
            <DialogTitle>Copy Contents</DialogTitle>
            <Checkbox
                checked={config.spaces}
                onChange={() => setConfig({ ...config, spaces: !config.spaces })}
            />
            <Checkbox
                checked={config.skipHeader}
                onChange={() => setConfig({ ...config, skipHeader: !config.skipHeader })}
            />
            <textarea style={{ minWidth: 300, minHeight: 300 }} value={text} />
        </Dialog>
    );
};

export default CopyDialog;
