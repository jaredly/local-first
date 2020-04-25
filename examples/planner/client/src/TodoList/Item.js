// @flow
import Checkbox from '@material-ui/core/Checkbox';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Chip from '@material-ui/core/Chip';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core/styles';
import AddBoxOutlined from '@material-ui/icons/Add';
import Folder from '@material-ui/icons/Folder';
import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown';
import CheckCircle from '@material-ui/icons/CheckCircle';
import Info from '@material-ui/icons/Info';
import Cancel from '@material-ui/icons/Cancel';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import * as React from 'react';
import type { Client, Collection, SyncStatus } from '../../../../../packages/client-bundle';
import { useItem, useItems } from '../../../../../packages/client-react';
import { type ItemT, newItem } from '../types';
import { useLocalStorageSharedToggle } from '../useLocalStorage';

import { ItemChildren } from './ItemChildren';
import Description from './Description';

const INDENT = 24;

export type DragInit = {
    id: string,
    path: Array<string>,
    onStart: () => void,
    onFinish: () => void,
    pos: { x: number, y: number },
};

type Props = {
    // col: Collection<ItemT>,
    path: Array<string>,
    level: number,
    item: ItemT,
    idx: number,
    client: Client<SyncStatus>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
    setRootPath: (Array<string>) => void,
};

export type DragRefs = {
    [key: string]: {
        id: string,
        path: Array<string>,
        parent: boolean,
        node: any,
        idx: number,
    },
};

const getMenuItems = ({
    item,
    col,
    path,
    setEditing,
    showDescription,
    setShowDescription,
    setOpen,
    open,
}) => {
    const menuItems = [
        {
            title: 'Edit text',
            onClick: () => {
                setTimeout(() => {
                    setEditing(item.title);
                }, 5);
            },
        },
    ];
    if (item.style !== 'group') {
        menuItems.push({
            title: 'Add attempt',
            onClick: () => {
                col.setAttribute(item.id, ['checkDates', Date.now().toString(36)], true);
            },
        });
    }
    if (item.children.length === 0 && !open) {
        menuItems.push({ title: 'Add child', onClick: () => setOpen(true) });
    }
    if (!showDescription) {
        menuItems.push({
            title: item.description ? 'Show description' : 'Add description',
            onClick: () => {
                setShowDescription(true);
            },
        });
    }
    if (showDescription) {
        menuItems.push({
            title: 'Hide description',
            onClick: () => {
                setShowDescription(false);
            },
        });
    }
    if (item.style === 'group') {
        menuItems.push({
            title: 'Convert to checkbox',
            onClick: () => {
                col.setAttribute(item.id, ['style'], null);
            },
        });
    } else {
        menuItems.push({
            title: 'Convert to group',
            onClick: () => {
                col.setAttribute(item.id, ['style'], 'group');
            },
        });
    }
    menuItems.push({
        title: 'Delete',
        onClick: async () => {
            const pid = path[path.length - 1];
            await Promise.all([
                col.clearAttribute(pid, ['children', item.id]),
                col.delete(item.id),
            ]);
        },
    });
    return menuItems;
};

export const Item = React.memo<Props>(
    ({ item, idx, onDragStart, client, level, showAll, path, dragRefs, setRootPath }: Props) => {
        const [col, items] = useItems(React, client, 'items', item.children);

        const [open, setOpen] = useLocalStorageSharedToggle('planner-ui-state', item.id + '%open');
        const [showDescription, setShowDescription] = useLocalStorageSharedToggle(
            'planner-ui-state',
            item.id + '%desc',
        );
        const [editing, setEditing] = React.useState(null);
        const styles = useStyles();

        const [menu, setMenu] = React.useState(false);
        const [anchorEl, setAnchorEl] = React.useState(null);
        const [dragging, setDragging] = React.useState(false);
        const [newFocus, setNewFocus] = React.useState(false);

        const childPath = React.useMemo(() => path.concat([item.id]), [path]);

        const menuItems = getMenuItems({
            item,
            col,
            path,
            setEditing,
            showDescription,
            setShowDescription,
            setOpen,
            open,
        });

        const visibleChildren = Object.keys(items)
            .map((k) => items[k])
            .filter(Boolean)
            .filter((item) =>
                showAll ? true : item.style === 'group' || item.completedDate == null,
            ).length;

        return (
            <div className={styles.itemWrapper + (dragging ? ' ' + styles.dragItem : '')}>
                <div className={styles.item} style={{ paddingLeft: level * INDENT }}>
                    {item.style === 'group' || item.children.length > 0 || open ? (
                        <div
                            style={{
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            onClick={() => setOpen(!open)}
                        >
                            {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                        </div>
                    ) : !!item.description ? (
                        <div
                            style={{
                                padding: 6,
                                paddingTop: 11,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            onClick={() => setShowDescription(!showDescription)}
                        >
                            <Info
                                fontSize="small"
                                className={showDescription ? styles.infoIcon : styles.infoIconOff}
                            />
                        </div>
                    ) : (
                        <div style={{ width: 32 }} />
                    )}
                    <div
                        ref={(node) => {
                            if (node) {
                                dragRefs[item.id] = {
                                    id: item.id,
                                    path,
                                    node,
                                    idx,
                                    parent:
                                        item.children.length > 0 || item.style === 'group' || open,
                                };
                            } else {
                                delete dragRefs[item.id];
                            }
                        }}
                        className={newFocus ? styles.itemNewFocus : undefined}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'row',
                            flex: 1,
                            alignItems: 'flex-start',
                        }}
                    >
                        {item.style === 'group' ? (
                            <div
                                style={{ padding: 9 }}
                                onClick={() => setRootPath(path.concat([item.id]))}
                            >
                                <Folder />
                            </div>
                        ) : (
                            <Checkbox
                                // type="checkbox"
                                checked={!!item.completedDate}
                                onChange={() => {
                                    col.setAttribute(
                                        item.id,
                                        ['completedDate'],
                                        item.completedDate != null ? null : Date.now(),
                                    );
                                }}
                                onClick={(evt) => evt.stopPropagation()}
                            />
                        )}
                        <div
                            className={`${
                                item.style === 'group' ? styles.groupTitle : styles.itemTitle
                            } ${item.completedDate != null ? styles.completed : ''}`}
                        >
                            {editing != null ? (
                                <TextField
                                    autoFocus
                                    multiline
                                    className={styles.input}
                                    // inputProps={{
                                    //     style: { fontSize: 'inherit' },
                                    // }}
                                    // size="medium"
                                    onClick={(evt) => evt.stopPropagation()}
                                    value={editing}
                                    onChange={(evt) => setEditing(evt.target.value)}
                                    onKeyDown={(evt) => {
                                        if (evt.key === 'Enter' && editing.trim().length > 0) {
                                            col.setAttribute(item.id, ['title'], editing);
                                            setEditing(null);
                                        }
                                    }}
                                    onBlur={() => setEditing(null)}
                                />
                            ) : (
                                item.title
                            )}
                        </div>
                        {Object.keys(item.checkDates).length ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                }}
                            >
                                {Object.keys(item.checkDates).map((date) => (
                                    <div
                                        key={date}
                                        title={new Date(parseInt(date, 36)).toLocaleString()}
                                    >
                                        ✅
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {!open && visibleChildren > 0 ? <Chip label={visibleChildren} /> : null}

                    <IconButton
                        aria-label="more"
                        // aria-controls="long-menu"
                        aria-haspopup="true"
                        style={{ touchAction: 'none' }}
                        onTouchStart={(evt) => {
                            console.log('touch');
                            // evt.preventDefault();
                            onDragStart({
                                id: item.id,
                                path,
                                onStart: () => setDragging(true),
                                onFinish: () => setDragging(false),
                                pos: { x: evt.clientX, y: evt.clientY },
                            });
                        }}
                        onMouseDown={(evt) => {
                            console.log('hello');
                            // evt.preventDefault();
                            // um maybe I need to pass an onstart too?
                            // setDragging(true);
                            onDragStart({
                                id: item.id,
                                path,
                                onStart: () => setDragging(true),
                                onFinish: () => setDragging(false),
                                pos: { x: evt.clientX, y: evt.clientY },
                            });
                        }}
                        onClick={(evt) => {
                            evt.stopPropagation();
                            setMenu(true);
                        }}
                        ref={setAnchorEl}
                    >
                        <MoreVertIcon />
                    </IconButton>
                    {menu ? (
                        <Menu
                            id="long-menu"
                            anchorEl={anchorEl}
                            keepMounted
                            open={menu}
                            onClick={(evt) => evt.stopPropagation()}
                            onClose={() => setMenu(false)}
                        >
                            {menuItems.map((item) => (
                                <MenuItem
                                    key={item.title}
                                    onClick={() => {
                                        item.onClick();
                                        setMenu(false);
                                    }}
                                >
                                    {item.title}
                                </MenuItem>
                            ))}
                        </Menu>
                    ) : null}
                </div>
                {showDescription ? (
                    <div style={{ paddingLeft: level * INDENT, marginLeft: 42, marginBottom: 8 }}>
                        <Description
                            text={item.description}
                            onChange={(text) => {
                                col.setAttribute(item.id, ['description'], text);
                            }}
                        />
                    </div>
                ) : null}
                {open ? (
                    <ItemChildren
                        onNewFocus={setNewFocus}
                        setRootPath={setRootPath}
                        path={childPath}
                        onDragStart={onDragStart}
                        dragRefs={dragRefs}
                        showAll={showAll}
                        item={item}
                        items={items}
                        level={level}
                        client={client}
                        col={col}
                    />
                ) : null}
            </div>
        );
    },
);

const useStyles = makeStyles((theme) => ({
    container: {},
    infoIconOff: {
        color: theme.palette.text.disabled,
    },
    infoIcon: {
        color: theme.palette.info.light,
    },
    input: {
        color: 'inherit',
        width: '100%',
        // fontSize: 32,
        padding: '4px 8px',
        backgroundColor: 'inherit',
        border: 'none',
        // borderBottom: `2px solid ${theme.palette.primary.dark}`,
        ...theme.typography.body1,
        fontWeight: 300,
    },
    inputWrapper: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemWrapper: {
        transition: `background-color ease .5s`,
    },
    dragItem: {
        backgroundColor: theme.palette.primary.dark,
    },
    item: {
        display: 'flex',
        flexDirection: 'row',
        // alignItems: 'center',
        alignItems: 'flex-start',
        // cursor: 'pointer',
    },
    groupTitle: {
        flex: 1,
        // padding: theme.spacing(2),
        ...theme.typography.h5,
        fontWeight: 500,
        // color: theme.palette.primary.dark,
        margin: 5,
    },
    itemTitle: {
        flex: 1,
        // padding: theme.spacing(2),
        ...theme.typography.body1,
        fontWeight: 300,
        margin: 5,
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
        minHeight: 34,
    },
    itemChildren: {
        // paddingLeft: theme.spacing(2),
    },
    completed: {
        textDecoration: 'line-through',
        textDecorationColor: theme.palette.primary.light,
        color: theme.palette.text.disabled,
    },
    itemNewFocus: {
        color: theme.palette.primary.light,
    },
    numHidden: {
        color: theme.palette.text.disabled,
        paddingLeft: theme.spacing(2),
        marginBottom: theme.spacing(1),
    },
}));
