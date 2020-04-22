// @flow
import Checkbox from '@material-ui/core/Checkbox';
import IconButton from '@material-ui/core/IconButton';
import Chip from '@material-ui/core/Chip';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core/styles';
import AddBoxOutlined from '@material-ui/icons/Add';
import Folder from '@material-ui/icons/Folder';
import KeyboardArrowRight from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import * as React from 'react';
import type { Client, Collection, SyncStatus } from '../../../../packages/client-bundle';
import { useItem } from '../../../../packages/client-react';
import { type ItemT, newItem } from './types';

const INDENT = 24;

export const NewItem = ({ onAdd, level }: { onAdd: (string) => void, level: number }) => {
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
    pid,
    dragRefs,
    onDragStart,
}: {
    item: ItemT,
    level: number,
    client: Client<SyncStatus>,
    col: Collection<ItemT>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (id: string, pid: string) => void,
    pid: string,
}) => {
    const styles = useStyles();
    return (
        <div className={styles.itemChildren}>
            {item.children.map((child) => (
                <Item
                    pid={pid}
                    showAll={showAll}
                    onDragStart={onDragStart}
                    level={level + 1}
                    dragRefs={dragRefs}
                    id={child}
                    key={child}
                    client={client}
                />
            ))}
            <NewItem
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

type Props = {
    pid: string,
    level: number,
    id: string,
    client: Client<SyncStatus>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (id: string, pid: string) => void,
};

export type DragRefs = { [key: string]: any };

const useLocalStorageState = (key, initial) => {
    const [current, setCurrent] = React.useState(() => {
        const raw = localStorage[key];
        return raw == null ? initial : JSON.parse(raw);
    });
    const set = React.useCallback(
        (value) => {
            localStorage[key] = JSON.stringify(value);
            setCurrent(value);
        },
        [setCurrent],
    );
    return [current, set];
};

export const Item = React.memo<Props>(
    ({ id, onDragStart, client, level, showAll, pid, dragRefs }: Props) => {
        const [col, item] = useItem(React, client, 'items', id);
        const [open, setOpen] = useLocalStorageState(id + '%open', false);
        const [editing, setEditing] = React.useState(null);
        const styles = useStyles();

        const [menu, setMenu] = React.useState(false);
        const [anchorEl, setAnchorEl] = React.useState(null);

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
                await col.clearAttribute(pid, ['children', id]);
                await col.delete(id);
            },
        });

        return (
            <div className={styles.itemWrapper}>
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
                    ) : (
                        <div style={{ width: 32 }} />
                    )}
                    <div
                        ref={(node) => {
                            if (node) {
                                dragRefs[id] = { id, pid, node };
                            }
                        }}
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flex: 1,
                            alignItems: 'center',
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
                                <input
                                    autoFocus
                                    className={styles.input}
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

                    <IconButton
                        aria-label="more"
                        // aria-controls="long-menu"
                        aria-haspopup="true"
                        onMouseDown={(evt) => {
                            //
                            onDragStart(id, pid);
                        }}
                        // onClick={(evt) => {
                        //     evt.stopPropagation();
                        //     setMenu(true);
                        // }}
                        ref={setAnchorEl}
                    >
                        <MoreVertIcon />
                    </IconButton>

                    {/* <IconButton
                    aria-label="more"
                    // aria-controls="long-menu"
                    aria-haspopup="true"
                    onClick={(evt) => {
                        evt.stopPropagation();
                        setMenu(true);
                    }}
                    ref={setAnchorEl}
                >
                    <MoreVertIcon />
                </IconButton> */}
                    {/* <Menu
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
                </Menu> */}
                </div>
                {open ? (
                    <ItemChildren
                        pid={id}
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

const useStyles = makeStyles(
    (theme) => (
        console.log(theme),
        {
            container: {},
            input: {
                color: 'inherit',
                width: '100%',
                // fontSize: 32,
                padding: '4px 8px',
                backgroundColor: 'inherit',
                border: 'none',
                borderBottom: `2px solid ${theme.palette.primary.dark}`,
                ...theme.typography.h5,
                fontWeight: 300,
            },
            inputWrapper: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                '&:hover': {
                    backgroundColor: theme.palette.primary.light,
                },
            },
            itemWrapper: {},
            item: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                cursor: 'pointer',
                // padding: `${theme.spacing(1)}px ${theme.spacing(3)}px`,
                '&:hover': {
                    backgroundColor: theme.palette.primary.light,
                },
            },
            groupTitle: {
                flex: 1,
                // padding: theme.spacing(2),
                ...theme.typography.h5,
                fontWeight: 500,
                // color: theme.palette.primary.dark,
            },
            itemTitle: {
                flex: 1,
                // padding: theme.spacing(2),
                ...theme.typography.h5,
                fontWeight: 300,
            },
            itemChildren: {
                // paddingLeft: theme.spacing(2),
            },
            completed: {
                textDecoration: 'line-through',
                textDecorationColor: theme.palette.primary.light,
                color: theme.palette.text.disabled,
            },
        }
    ),
);
