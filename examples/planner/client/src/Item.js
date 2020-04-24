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
import type { Client, Collection, SyncStatus } from '../../../../packages/client-bundle';
import { useItem } from '../../../../packages/client-react';
import { type ItemT, newItem } from './types';
import { useLocalStorageSharedToggle } from './useLocalStorage';

const INDENT = 24;

export const NewItem = ({
    onAdd,
    level,
    onFocus,
}: {
    onAdd: (string) => void,
    level: number,
    onFocus: (boolean) => void,
}) => {
    const [text, setText] = React.useState('');
    const styles = useStyles();

    return (
        <div className={styles.inputWrapper} style={{ paddingLeft: level * INDENT }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <IconButton
                style={{ padding: 9 }}
                onClick={() => {
                    if (text.trim().length > 0) {
                        onAdd(text);
                        setText('');
                    }
                }}
            >
                <AddBoxOutlined />
            </IconButton>
            <input
                type="text"
                value={text}
                onChange={(evt) => setText(evt.target.value)}
                placeholder="Add item"
                className={styles.input}
                onFocus={() => onFocus(true)}
                onBlur={() => onFocus(false)}
                onKeyDown={(evt) => {
                    if (evt.key === 'Enter' && text.trim().length > 0) {
                        onAdd(text);
                        setText('');
                    }
                }}
            />
        </div>
    );
};

export const ItemChildren = ({
    item,
    level,
    client,
    col,
    showAll,
    path,
    dragRefs,
    onDragStart,
    onNewFocus,
}: {
    item: ItemT,
    level: number,
    client: Client<SyncStatus>,
    col: Collection<ItemT>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
    onNewFocus: (boolean) => void,
    path: Array<string>,
}) => {
    const styles = useStyles();
    return (
        <div className={styles.itemChildren}>
            {item.children.map((child, i) => (
                <Item
                    path={path}
                    showAll={showAll}
                    onDragStart={onDragStart}
                    level={level + 1}
                    dragRefs={dragRefs}
                    idx={i}
                    id={child}
                    key={child}
                    client={client}
                />
            ))}
            <NewItem
                onFocus={onNewFocus}
                level={level + 1}
                onAdd={(text) => {
                    const childId = client.getStamp();
                    if (text.startsWith('# ')) {
                        col.save(childId, { ...newItem(childId, text.slice(2)), style: 'group' });
                    } else {
                        col.save(childId, newItem(childId, text));
                    }
                    col.insertId(item.id, ['children'], item.children.length, childId);
                }}
            />
        </div>
    );
};

export type DragInit = {
    id: string,
    path: Array<string>,
    onStart: () => void,
    onFinish: () => void,
    pos: { x: number, y: number },
};

type Props = {
    path: Array<string>,
    level: number,
    id: string,
    idx: number,
    client: Client<SyncStatus>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
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

// const useLocalStorageState = (key, initial) => {
//     const [current, setCurrent] = React.useState(() => {
//         const raw = localStorage[key];
//         return raw == null ? initial : JSON.parse(raw);
//     });
//     const set = React.useCallback(
//         (value) => {
//             localStorage[key] = JSON.stringify(value);
//             setCurrent(value);
//         },
//         [setCurrent],
//     );
//     return [current, set];
// };

const Description = ({ text, onChange }) => {
    const [editing, onEdit] = React.useState(null);
    return editing != null ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <TextField
                multiline
                style={{ flex: 1 }}
                value={editing}
                onChange={(evt) => onEdit(evt.target.value)}
                onKeyDown={(evt) => {
                    if (evt.key === 'Enter' && (evt.metaKey || evt.shiftKey || evt.ctrlKey)) {
                        if (editing != text) {
                            onChange(editing);
                        }
                        onEdit(null);
                    }
                }}
            />
            <IconButton
                onClick={() => {
                    if (editing != text) {
                        onChange(editing);
                    }
                    onEdit(null);
                }}
            >
                <CheckCircle />
            </IconButton>
            <IconButton onClick={() => onEdit(null)}>
                <Cancel />
            </IconButton>
        </div>
    ) : (
        <div
            onClick={() => onEdit(text)}
            style={{
                fontStyle: 'italic',
                whiteSpace: 'pre-wrap',
            }}
        >
            {!!text ? text : 'Add description'}
        </div>
    );
};

export const Item = React.memo<Props>(
    ({ id, idx, onDragStart, client, level, showAll, path, dragRefs }: Props) => {
        const [col, item] = useItem(React, client, 'items', id);
        const [open, setOpen] = useLocalStorageSharedToggle('planner-ui-state', id + '%open');
        const [showDescription, setShowDescription] = useLocalStorageSharedToggle(
            'planner-ui-state',
            id + '%desc',
        );
        const [editing, setEditing] = React.useState(null);
        const styles = useStyles();

        const [menu, setMenu] = React.useState(false);
        const [anchorEl, setAnchorEl] = React.useState(null);
        const [dragging, setDragging] = React.useState(false);
        const [newFocus, setNewFocus] = React.useState(false);

        const childPath = React.useMemo(() => path.concat([id]), [path]);
        // if (!item) {
        //     return 'deleted';
        // }

        if (!item || (item.completedDate != null && !showAll)) {
            return null;
        }

        // if (!item) {
        //     return (
        //         <div
        //             className={styles.itemWrapper + ' ' + styles.item + ' ' + styles.itemTitle}
        //             style={{ padding: 8 }}
        //         >
        //             &nbsp;
        //         </div>
        //     );
        // }

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
                    col.setAttribute(id, ['style'], null);
                },
            });
        } else {
            menuItems.push({
                title: 'Convert to group',
                onClick: () => {
                    col.setAttribute(id, ['style'], 'group');
                },
            });
        }
        menuItems.push({
            title: 'Delete',
            onClick: async () => {
                const pid = path[path.length - 1];
                await Promise.all([col.clearAttribute(pid, ['children', id]), col.delete(id)]);
            },
        });

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
                                dragRefs[id] = {
                                    id,
                                    path,
                                    node,
                                    idx,
                                    parent: item.children.length > 0 || item.style === 'group',
                                };
                            } else {
                                delete dragRefs[id];
                            }
                        }}
                        className={newFocus ? styles.itemNewFocus : undefined}
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flex: 1,
                            alignItems: 'flex-start',
                        }}
                    >
                        {item.style === 'group' ? (
                            <div style={{ padding: 9 }}>
                                <Folder />
                            </div>
                        ) : (
                            <Checkbox
                                // type="checkbox"
                                checked={!!item.completedDate}
                                onChange={() => {
                                    col.setAttribute(
                                        id,
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
                                            col.setAttribute(id, ['title'], editing);
                                            setEditing(null);
                                        }
                                    }}
                                    onBlur={() => setEditing(null)}
                                />
                            ) : (
                                item.title
                            )}
                        </div>
                    </div>

                    {!open && item.children.length > 0 ? (
                        <Chip label={item.children.length} />
                    ) : null}

                    {/* <IconButton
                        aria-label="more"
                        // aria-controls="long-menu"
                        aria-haspopup="true"
                        onMouseDown={(evt) => {
                            //
                            setDragging(true);
                            onDragStart(id, pid, idx, () => setDragging(false));
                        }}
                        // onClick={(evt) => {
                        //     evt.stopPropagation();
                        //     setMenu(true);
                        // }}
                        ref={setAnchorEl}
                    >
                        <MoreVertIcon />
                    </IconButton> */}

                    <IconButton
                        aria-label="more"
                        // aria-controls="long-menu"
                        aria-haspopup="true"
                        onMouseDown={(evt) => {
                            // um maybe I need to pass an onstart too?
                            // setDragging(true);
                            onDragStart({
                                id,
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
                        path={childPath}
                        onDragStart={onDragStart}
                        dragRefs={dragRefs}
                        showAll={showAll}
                        item={item}
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
        transition: ` background-color ease .3s`,
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
}));
