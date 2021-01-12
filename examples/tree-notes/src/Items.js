// @flow
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

type Dest =
    | {
          type: 'before',
          path: Array<string>,
      }
    | {
          type: 'child',
          path: Array<string>,
      }
    | {
          type: 'after',
          path: Array<string>,
      }
    | { type: 'self' };
export type DragTarget = DropTarget<Dest>;

const useDragging = (onDrop) => {
    const targetMakers = React.useMemo(() => ({}), []);

    const [dragger, setDragger] = React.useState((null: ?DragState<Dest>));
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    const onDragStart = React.useCallback((evt, path) => {
        if (evt.button !== 0) {
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        const targets = [].concat(...Object.keys(targetMakers).map((id) => targetMakers[id](path)));
        targets.sort((a, b) => a.top - b.top);
        console.log(targets);
        setDragger({
            dragging: {
                pos: { x: evt.clientX, y: evt.clientY },
                path,
            },
            started: false,
            dest: null,
            dims: null,
            targets,
            path,
        });
    }, []);

    React.useEffect(() => {
        if (dragger != null) {
            return setupDragListeners(
                dragger.targets,
                currentDragger,
                false,
                setDragger,
                (dragInit, dest) => {
                    onDrop(dragInit, dest);
                },
            );
        }
    }, [!!dragger]);

    const registerDragTargets = React.useCallback((id, cb) => {
        if (!cb) {
            delete targetMakers[id];
        } else {
            targetMakers[id] = cb;
        }
    }, []);
    return { onDragStart, registerDragTargets, dragger };
};

const emptyPath = [];

const Items = ({
    client,
    local,
    col,
}: // id,
{
    client: Client<SyncStatus>,
    local: LocalClient,
    col: Collection<ItemT>,
    // id: ?string,
}) => {
    const onDrop = React.useCallback(({ path }, dest) => {
        const id = path[path.length - 1];
        const pid = path[path.length - 2];
        if (!pid) {
            return;
        }
        console.log('drop it here', path, dest);
        if (dest.type === 'self') {
            return;
        }
        col.removeId(pid, ['children'], id);
        if (dest.type === 'after' || dest.type === 'before') {
            const npid = dest.path[dest.path.length - 2];
            const nrel = dest.path[dest.path.length - 1];
            if (!npid) {
                return;
            }
            col.insertIdRelative(npid, ['children'], id, nrel, dest.type === 'before');
            local.setExpanded(npid, true);
        } else {
            const npid = dest.path[dest.path.length - 1];
            col.insertId(npid, ['children'], 0, id);
            local.setExpanded(npid, true);
        }
        local.setFocus(id);
    }, []);
    const { registerDragTargets, onDragStart, dragger } = useDragging(onDrop);
    const { id } = useParams();
    const [menu, setMenu] = React.useState(null);

    return (
        <React.Fragment>
            <Item
                path={emptyPath}
                id={id || 'root'}
                client={client}
                local={local}
                registerDragTargets={registerDragTargets}
                onDragStart={onDragStart}
                onMenuShow={setMenu}
            />
            {dragger != null && dragger.dims != null && dragger.dest != null ? (
                <div
                    // className={styles.dragIndicator}
                    style={{
                        position: 'absolute',
                        // height: 2,
                        // marginTop: -2,
                        // backgroundColor: theme.palette.warning.dark,
                        backgroundColor: 'red',
                        opacity: 0.5,
                        mouseEvents: 'none',
                        // transition: `transform ease .1s`,
                        left: dragger.dims.left,
                        width: dragger.dims.width,
                        height: dragger.dims.height, // + 4,
                        transform: `translateY(${dragger.dims.top}px)`,
                        top: 0,
                    }}
                ></div>
            ) : null}
            {menu ? (
                <Menu
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    anchorEl={menu.handle}
                    getContentAnchorEl={null}
                    open={Boolean(menu)}
                    onClose={() => setMenu(null)}
                >
                    <ItemMenuItems
                        col={col}
                        client={client}
                        id={menu.item.id}
                        onClose={() => setMenu(null)}
                    />
                </Menu>
            ) : null}
        </React.Fragment>
    );
};

const ItemMenuItems = React.forwardRef(({ col, id, onClose, client }) => {
    const history = useHistory();
    const [_, item] = useItem(React, client, 'items', id);
    if (!item) {
        return null;
    }
    const items = [
        <MenuItem
            key="zoom"
            onClick={() => {
                history.push(`/item/${id}`);
                onClose();
            }}
        >
            Zoom to here
        </MenuItem>,
    ];
    items.push(
        <MenuItem
            key="completed"
            onClick={() => {
                col.setAttribute(
                    item.id,
                    ['completed'],
                    item.completed == null ? Date.now() : null,
                );
                onClose();
            }}
        >
            <FormControlLabel
                control={
                    <Checkbox
                        checked={item.completed != null}
                        onChange={() => {
                            col.setAttribute(
                                item.id,
                                ['completed'],
                                item.completed == null ? Date.now() : null,
                            );
                            onClose();
                        }}
                    />
                }
                label={'Completed'}
            />
        </MenuItem>,
    );
    items.push(
        <MenuItem key="style">
            Style:
            <ButtonGroup>
                {['header', 'todo'].map((style) => (
                    <Button
                        key={style}
                        size="small"
                        variant={item.style === style ? 'contained' : 'text'}
                        onClick={() => {
                            col.setAttribute(item.id, ['style'], style);
                        }}
                    >
                        {style}
                    </Button>
                ))}
            </ButtonGroup>
        </MenuItem>,
    );
    items.push(
        <MenuItem key="numbering">
            Numbering:
            <ButtonGroup>
                {['numbers', 'letters', 'roman', 'checkbox'].map((style) => (
                    <Button
                        key={style}
                        size="small"
                        variant={
                            item.numbering != null && item.numbering.style === style
                                ? 'contained'
                                : 'text'
                        }
                        onClick={() => {
                            col.setAttribute(
                                item.id,
                                ['numbering'],
                                item.numbering?.style === style ? null : { style },
                            );
                            // onClose();
                        }}
                    >
                        {style}
                    </Button>
                ))}
            </ButtonGroup>
        </MenuItem>,
    );
    return items;
});

export default Items;
