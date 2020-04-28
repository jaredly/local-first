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
import RadioButtonUnchecked from '@material-ui/icons/RadioButtonUnchecked';
import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown';
import CheckCircle from '@material-ui/icons/CheckCircle';
import Info from '@material-ui/icons/Info';
import Cancel from '@material-ui/icons/Cancel';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import * as React from 'react';
import type { Client, Collection, SyncStatus } from '../../../../../packages/client-bundle';
import { useItem, useItems } from '../../../../../packages/client-react';
import { type ItemT, newItem, newDay } from '../types';
import { useLocalStorageSharedToggle } from '../useLocalStorage';
import { showDate, today, tomorrow } from '../utils';

import { ItemChildren } from './ItemChildren';
import Description from './Description';

import { type DragInit } from './dragging';

const INDENT = 24;

type Props = {
    path: Array<string>,
    level: number,
    item: ItemT,
    idx: number,
    client: Client<SyncStatus>,
    // showAll: boolean,
    show: (ItemT) => boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
    setRootPath: (Array<string>) => void,

    selection?: ?{ map: { [key: string]: boolean }, set: (string, boolean) => void },
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

const scheduleItem = async (client, id, dayId) => {
    const dayCol = client.getCollection('days');
    let day = await dayCol.load(dayId);
    if (day == null) {
        day = newDay(dayId);
        await dayCol.save(dayId, day);
    }
    dayCol.insertId(dayId, ['toDoList', 'others'], day.toDoList.others.length, id);
};

const getMenuItems = ({
    client,
    item,
    col,
    path,
    setEditing,
    showDescription,
    setShowDescription,
    setOpen,
    open,
    setCommenting,
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
    } else {
        if (item.completedDate == null) {
            menuItems.push({
                title: 'Mark completed',
                onClick: () => {
                    col.setAttribute(item.id, ['completedDate'], Date.now());
                },
            });
        } else {
            menuItems.push({
                title: 'Mark incomplete',
                onClick: () => {
                    col.setAttribute(item.id, ['completedDate'], null);
                },
            });
        }
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
    if (item.completedDate == null && item.style !== 'group') {
        menuItems.push({
            title: 'Schedule today',
            onClick: () => {
                scheduleItem(client, item.id, showDate(today()));
            },
        });
        menuItems.push({
            title: 'Schedule tomorrow',
            onClick: () => {
                scheduleItem(client, item.id, showDate(tomorrow()));
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
        title: 'Add comment',
        onClick: () => setCommenting(true),
    });
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

const SelectionButton = ({ selection, id }) => {
    return (
        <IconButton onClick={() => selection.set(id, !selection.map[id])}>
            {selection.map[id] ? <CheckCircle /> : <RadioButtonUnchecked />}
        </IconButton>
    );
};

export const Item = React.memo<Props>(
    ({
        item,
        idx,
        onDragStart,
        client,
        level,
        show,
        path,
        dragRefs,
        setRootPath,
        selection,
    }: Props) => {
        const [col, items] = useItems(React, client, 'items', item.children);

        const [open, setOpen] = selection
            ? React.useState(item.style === 'group' ? level < 3 : false)
            : useLocalStorageSharedToggle('planner-ui-state', item.id + '%open');
        const [showDescription, setShowDescription] = selection
            ? React.useState(false)
            : useLocalStorageSharedToggle('planner-ui-state', item.id + '%desc');
        const [editing, setEditing] = React.useState(null);
        const styles = useStyles();
        const [commenting, setCommenting] = React.useState(false);

        const [menu, setMenu] = React.useState(false);
        const [anchorEl, setAnchorEl] = React.useState(null);
        const [dragging, setDragging] = React.useState(false);
        const [newFocus, setNewFocus] = React.useState(false);

        const childPath = React.useMemo(() => path.concat([item.id]), [path]);

        const menuItems = getMenuItems({
            client,
            item,
            col,
            path,
            setCommenting,
            setEditing,
            showDescription,
            setShowDescription,
            setOpen,
            open,
        });

        if (!items) {
            // I think this is what we want?
            return null;
        }

        const visibleChildren = Object.keys(items)
            .map((k) => items[k])
            .filter(Boolean)
            .filter((item) =>
                // showAll ? true : item.style === 'group' || item.completedDate == null,
                show(item),
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
                    ) : !!item.description ||
                      (item.comments && Object.keys(item.comments).length) ? (
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
                        ) : selection ? (
                            <SelectionButton selection={selection} id={item.id} />
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
                        {item.comments ? <ShowComments comments={item.comments} /> : null}
                    </div>
                ) : null}
                {open ? (
                    <ItemChildren
                        selection={selection}
                        onNewFocus={setNewFocus}
                        setRootPath={setRootPath}
                        path={childPath}
                        onDragStart={onDragStart}
                        dragRefs={dragRefs}
                        show={show}
                        item={item}
                        items={items}
                        level={level}
                        client={client}
                        col={col}
                    />
                ) : null}
                {commenting ? (
                    <AddCommentDialog
                        onClose={() => setCommenting(false)}
                        onAdd={(text) => {
                            const id = client.getStamp();
                            if (!item.comments) {
                                // TODO we want this "comments" object to have the MIN stamp
                                // ideally
                                col.setAttribute(item.id, ['comments'], {
                                    [id]: { date: Date.now(), text },
                                });
                            } else {
                                col.setAttribute(item.id, ['comments', id], {
                                    date: Date.now(),
                                    text,
                                });
                            }
                            setCommenting(false);
                        }}
                    />
                ) : null}
            </div>
        );
    },
);

const ShowComments = ({ comments }) => {
    return (
        <React.Fragment>
            {Object.keys(comments).map((id) => (
                <div style={{ padding: 8 }}>
                    {comments[id].text}
                    <div style={{ fontStyle: 'italic', textAlign: 'right' }}>
                        {new Date(comments[id].date).toDateString()}
                    </div>
                </div>
            ))}
        </React.Fragment>
    );
};

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import Button from '@material-ui/core/Button';
const genId = () => Math.random().toString(36).slice(2);
const AddCommentDialog = ({ onClose, onAdd }) => {
    const id = React.useMemo(() => 'id-' + genId(), []);
    const [text, setText] = React.useState('');
    return (
        <Dialog open={true}>
            <DialogTitle id={id}>Data Export</DialogTitle>
            <div style={{ padding: 16 }}>
                <TextField
                    label="Comment text"
                    value={text}
                    fullWidth
                    multiline
                    onChange={(evt) => setText(evt.target.value)}
                />
                <Button
                    onClick={() => {
                        if (text.trim().length > 0) {
                            onAdd(text);
                        }
                    }}
                    disabled={text.trim().length === 0}
                >
                    Add comment
                </Button>
                <Button onClick={() => onClose()}>Cancel</Button>
            </div>
        </Dialog>
    );
};

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
        // textDecoration: 'line-through',
        // textDecorationColor: theme.palette.text.disabled,
        fontStyle: 'italic',
        // textDecorationColor: theme.palette.primary.light,
        // color: theme.palette.primary.light,
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
