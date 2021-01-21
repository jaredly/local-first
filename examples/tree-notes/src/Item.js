// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';
import { useCollection, useItem } from '../../../packages/client-react';
import { type Client, type Collection } from '../../../packages/client-bundle';
import QuillEditor from './QuillEditor';
import type { ItemT } from '../collections';
import * as navigation from './navigation';
import LocalClient, { useExpanded } from './LocalClient';
import { type DragTarget } from './Items';
import { length } from '../../../packages/rich-text-crdt/utils';
import * as rich from '../../../packages/rich-text-crdt/';
import { blankItem } from './types';
import Checkbox from '@material-ui/core/Checkbox';

const arrayStartsWith = (needle, haystack) => {
    if (haystack.length < needle.length) {
        return false;
    }
    for (let i = 0; i < needle.length; i++) {
        if (needle[i] !== haystack[i]) {
            return false;
        }
    }
    return true;
};

export const itemActions = ({
    client,
    col,
    path,
    level,
    id,
    local,
}: {
    client: Client<*>,
    col: Collection<ItemT>,
    path: Array<string>,
    level: number,
    id: string,
    local: LocalClient,
}) => ({
    onUp() {
        const up = navigation.goUp(local, col, path, id, level);
        if (up != null) {
            local.setFocus(up);
            return true;
        }
    },
    onIndent() {
        const newParent = navigation.indent(client, col, path, id);
        if (newParent != null) {
            local.setExpanded(newParent, true);
            local.setFocus(id);
            return true;
        }
        return false;
    },
    onDedent() {
        if (navigation.dedent(client, col, path, id)) {
            local.setFocus(id);
            return true;
        }
        return false;
    },
    onBackspace(contents: ?string) {
        if (contents == null) {
            const up = navigation.goUp(local, col, path, id, level);
            navigation.deleteNode(col, path, id);
            if (up != null) {
                local.setFocus(up);
            }
            return true;
        }
    },
    onDown() {
        const down = navigation.goDown(local, col, path, id, level);
        if (down) {
            local.setFocus(down);
            return true;
        }
    },
    onLeft() {
        const up = navigation.goUp(local, col, path, id, level);
        if (up != null) {
            local.setFocus(up);
            return true;
        }
    },
    onRight() {
        const down = navigation.goDown(local, col, path, id, level);
        if (down) {
            local.setFocus(down);
            return true;
        }
    },
    onEnter() {
        const current = col.getCached(id);
        if (!current) return;
        if ((current.children.length && local.isExpanded(id)) || level === 0) {
            const nid = navigation.createChild(client, col, path, id);
            local.setFocus(nid);
        } else if (level > 0) {
            const nid = navigation.createSibling(client, col, path, id);
            if (nid != null) {
                local.setFocus(nid);
            }
        }
    },
    onCreateChild() {
        local.setExpanded(id, true);
        const newId = navigation.createChild(client, col, path, id);
        local.setFocus(newId);
    },
    onCreateAunt() {
        const newId = navigation.createAunt(client, col, path, id);
        local.setFocus(newId);
    },
});

const TARGET_HEIGHT = 5;

const dragHandler = ({ level, node, childPath, bodyRef, col, id, local }) => (currentPath) => {
    // TODO need to be able to escape a parent. So if you are a descendent of a thing
    // that should not prevent you from going above or below the thing.
    // it's only that you shouldn't be able to go inside yourself.
    if (childPath.length === 1) {
        return [];
    }
    const body = bodyRef.current;
    if (!body) {
        return [];
    }
    const parent = node.offsetParent;
    if (!parent) {
        return [];
    }
    const box = node.getBoundingClientRect();
    if (arrayStartsWith(currentPath, childPath)) {
        if (currentPath.length === childPath.length) {
            return [
                {
                    parent,
                    top: box.top,
                    height: box.bottom - box.top,
                    left: box.left,
                    width: box.width,
                    dest: { type: 'self' },
                },
            ];
        }
        return [];
    }
    const bodyBox = body.getBoundingClientRect();
    const current = col.getCached(id);
    if (!current) {
        return [];
    }
    const pTop = parent.getBoundingClientRect().top;
    if (local.isExpanded(id) && current.children.length) {
        return [
            {
                parent,
                top: bodyBox.top - TARGET_HEIGHT / 2,
                height: TARGET_HEIGHT,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'before', path: childPath },
            },
            {
                parent,
                top: bodyBox.bottom - TARGET_HEIGHT / 2,
                height: TARGET_HEIGHT,
                left: bodyBox.left + 30,
                width: bodyBox.width,
                dest: { type: 'child', path: childPath },
            },
            {
                parent,
                top: box.bottom - TARGET_HEIGHT / 2,
                height: TARGET_HEIGHT,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'after', path: childPath },
            },
            // above (top half)
            // firstChild (bottom half)
            // below (line at end of children)
        ];
    } else {
        return [
            // above
            {
                parent,
                top: bodyBox.top - TARGET_HEIGHT / 2,
                height: TARGET_HEIGHT,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'before', path: childPath },
            },
            // below
            {
                parent,
                top: bodyBox.bottom - TARGET_HEIGHT / 2,
                height: TARGET_HEIGHT,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'after', path: childPath },
            },
        ];
    }
};

const blankBody = () => {
    const crdt = rich.init();
    return rich.apply(crdt, rich.insert(crdt, ':root:', 0, '\n'));
};
const defaultEmptyBody = blankBody();

type Props = {
    path: Array<string>,
    id: string,
    client: Client<*>,
    local: LocalClient,
    onDragStart: (MouseEvent, Array<string>) => void,
    registerDragTargets: (string, ?(Array<string>) => Array<DragTarget>) => void,
    onMenuShow: ({ path: Array<string>, handle: HTMLElement }) => mixed,
    numbering?: ?{ style: string, startWith?: number },
    root?: boolean,
    level: number,
};

const Item = ({
    path,
    id,
    root,
    client,
    local,
    level,
    registerDragTargets,
    onDragStart,
    onMenuShow,
    numbering,
}: Props) => {
    const [col, item] = useItem<ItemT, *>(React, client, 'items', id);
    const childPath = React.useMemo(() => path.concat([id]), [path, id]);
    const bodyRef = React.useRef(null);
    const isExpanded = useExpanded(local, id);

    const blingColor =
        path.length === 0 ? 'transparent' : `rgba(255,255,255,${1 - (path.length % 5) / 5})`;

    if (item === false) {
        return null; // loading
    }
    if (item == null) {
        if (id === 'root') {
            return (
                <button
                    onClick={() => {
                        const item = { ...blankItem(), id };
                        col.save(id, item);
                        console.log('saving');
                    }}
                >
                    Create root
                </button>
            );
        }
        return 'Item does not exist';
    }
    const collapsible = !root && item.children.length > 0;
    const collapsed = collapsible && !isExpanded; // !local.isExpanded(id);
    return (
        <div
            ref={(node) => {
                if (node) {
                    registerDragTargets(
                        id,
                        dragHandler({
                            node,
                            level,
                            childPath,
                            bodyRef,
                            col,
                            id,
                            local,
                        }),
                    );
                } else {
                    registerDragTargets(id, null);
                }
            }}
        >
            <div
                css={{
                    display: 'flex',
                    flexDirection: 'row',
                    '&:hover .drag-handle': {
                        visibility: 'visible',
                    },
                    userSelect: 'none',
                }}
                ref={(node) => (bodyRef.current = node)}
                onContextMenu={(evt) => {
                    evt.preventDefault();
                    onMenuShow({ path: childPath, handle: evt.currentTarget });
                }}
            >
                {!root ? (
                    <div
                        className="drag-handle"
                        css={{
                            width: 10,
                            top: 0,
                            bottom: 0,
                            background: '#aaa',
                            visibility: 'hidden',
                            cursor: 'move',
                        }}
                        onMouseDown={(evt) => onDragStart(evt, childPath)}
                    />
                ) : null}
                <div
                    onContextMenu={(evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        onMenuShow({ path: childPath, handle: evt.currentTarget });
                    }}
                    onClick={
                        // evt => {
                        //     if (evt.ctrlKey || evt.metaKey || evt.button !== 0)
                        // }
                        collapsible
                            ? () => {
                                  local.setExpanded(id, collapsed);
                              }
                            : null
                    }
                    css={{
                        width: '2em',
                        alignSelf: 'stretch',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        ':hover': {
                            backgroundColor: 'rgba(255,255,255,0.1)',
                        },
                    }}
                >
                    {collapsed ? (
                        item.children.length
                    ) : (
                        <div
                            css={{
                                width: '.5em',
                                height: '.5em',
                                marginTop: '.5em',
                                backgroundColor: blingColor,
                                borderRadius: '.25em',
                            }}
                        />
                    )}
                </div>
                {numbering?.style === 'checkbox' ? (
                    // <Checkbox
                    //     checked={item.completed != null}
                    //     onChange={() => {
                    //         col.setAttribute(
                    //             item.id,
                    //             ['completed'],
                    //             item.completed == null ? Date.now() : null,
                    //         );
                    //     }}
                    // />
                    <input
                        type="checkbox"
                        checked={item.completed != null}
                        onChange={() => {
                            col.setAttribute(
                                item.id,
                                ['completed'],
                                item.completed == null ? Date.now() : null,
                            );
                        }}
                    />
                ) : null}
                <QuillEditor
                    css={{
                        flex: 1,
                        border: '1px dashed transparent',
                        borderBottomColor: length(item.body) <= 1 ? 'currentColor' : null,
                        ...(item.style === 'header'
                            ? { fontSize: '1.2em', fontWeight: 'bold' }
                            : null),
                        // textDecoration: item.completed != null ? 'line-through' : null,
                        opacity: item.completed != null ? 0.8 : null,
                        fontStyle: item.completed != null ? 'italic' : null,
                        // textDecorationColor: '#aaa',
                    }}
                    innerRef={(node) => {
                        local.register(id, node);
                        if (!node) {
                            local.onBlur(id, path);
                        }
                    }}
                    value={item.body}
                    actions={itemActions({ client, col, path, id, local, level })}
                    getStamp={client.getStamp}
                    onChange={(deltas) => {
                        // console.log('Ok', delta);
                        col.applyRichTextDelta(id, ['body'], deltas);
                    }}
                    onFocus={() => {
                        local.onFocus(id, path);
                    }}
                    onBlur={() => {
                        local.onBlur(id, path);
                    }}
                    siteId={client.sessionId}
                />
            </div>
            <div
                style={{
                    marginLeft: '1em',
                    paddingLeft: '1em',
                    borderLeft: '1px solid ' + blingColor,
                }}
            >
                {isExpanded || root
                    ? item.children
                          .filter(Boolean)
                          .map((id) => (
                              <MemoItem
                                  path={childPath}
                                  level={level + 1}
                                  id={id}
                                  key={id}
                                  client={client}
                                  local={local}
                                  onDragStart={onDragStart}
                                  registerDragTargets={registerDragTargets}
                                  onMenuShow={onMenuShow}
                                  numbering={item.numbering}
                              />
                          ))
                    : null}
            </div>
        </div>
    );
};

const MemoItem = React.memo<Props>(Item);

export default MemoItem;
