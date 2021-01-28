// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { useHistory, Route, Link, useRouteMatch, useParams } from 'react-router-dom';

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
} from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { type Client, type SyncStatus, type Collection } from '../../../packages/client-bundle';
import type { Data } from '../../shared/auth-api';
import type { AuthData } from '../../shared/Auth';

import LocalClient from './LocalClient';
import Item from './Item';
import { type DropTarget } from './dragging';
import { setupDragListeners, type DragInit, type DragState } from './dragging';
import type { ItemT } from '../collections';

import * as navigation from './navigation';
import { itemActions } from './Item';

type Props = {
    client: Client<*>,
    local: LocalClient,
};

const mapping = {
    onIndent: '>>',
    onDedent: '<<',
    onCreateChild: 'child',
    onCreateAunt: 'aunt',
};

const BottomBarCurrentFocused = ({ client, local }: Props) => {
    const [focused, setFocused] = React.useState(local._focused);
    React.useEffect(() => {
        local.onFocusChange((focused) => {
            setFocused(focused);
        });
    }, [local]);

    if (focused == null) {
        return null;
    }

    return (
        <BottomBar
            client={client}
            local={local}
            id={focused[0]}
            path={focused[1]}
            level={focused[2]}
        />
    );
};

const BottomBar = ({
    client,
    local,
    id,
    path,
    level,
}: {
    id: string,
    path: Array<string>,
    client: Client<*>,
    local: LocalClient,
    level: number,
}) => {
    const [col, item] = useItem<ItemT, _>(React, client, 'items', id);
    const actions = itemActions({ client, local, id, col, path, level, onZoom: () => {} });

    return (
        <div
            onMouseDown={(evt) => evt.stopPropagation()}
            css={{
                position: 'fixed',
                bottom: 0,
                // TODO: center if the screen is large
                left: 0,
                right: 0,
                backgroundColor: 'black',
                display: 'flex',
                justifyContent: 'center',
            }}
        >
            {Object.keys(mapping).map((k) => (
                <Button key={k} onClick={() => actions[k]()}>
                    {mapping[k]}
                </Button>
            ))}
            {/* <Button
            variant='contained'
            onClick={() => {
                //
            }}
            >Hello</Button> */}
        </div>
    );
};

export default BottomBarCurrentFocused;
