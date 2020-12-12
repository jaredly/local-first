// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';
import { useCollection, useItem } from '../../../packages/client-react';
import { type Client } from '../../../packages/client-bundle';
import QuillEditor from './QuillEditor';
import type { ItemT } from '../collections';
import * as navigation from './navigation';
import LocalClient from './LocalClient';
import { type DragTarget } from './App';
import { length } from '../../../packages/rich-text-crdt/utils';
import * as rich from '../../../packages/rich-text-crdt/';
import { blankItem } from './types';

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

const itemActions = ({ client, col, path, id, local }) => ({
    onUp() {
        const up = navigation.goUp(col, path, id);
        if (up != null) {
            local.setFocus(up);
            return true;
        }
    },
    onIndent() {
        console.log('indent');
        const newParent = navigation.indent(client, col, path, id);
        if (newParent != null) {
            local.setExpanded(newParent, true);
            return true;
        }
        return false;
    },
    onDedent() {
        return true;
    },
    onBackspace(contents: string) {
        if (contents == null) {
        }
    },
    onDown() {
        const down = navigation.goDown(col, path, id);
        if (down) {
            local.setFocus(down);
            return true;
        }
    },
    onLeft() {
        const up = navigation.goUp(col, path, id);
        if (up != null) {
            local.setFocus(up);
            return true;
        }
    },
    onRight() {
        const down = navigation.goDown(col, path, id);
        if (down) {
            local.setFocus(down);
            return true;
        }
    },
    onEnter() {
        // console.log('enter');
        const current = col.getCached(id);
        if (!current) return;
        if (current.children.length || !path.length) {
            const nid = navigation.createChild(client, col, path, id);
            local.setFocus(nid);
        } else {
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

const dragHandler = ({ node, childPath, bodyRef, col, id, local }) => (currentPath) => {
    if (arrayStartsWith(childPath, currentPath)) {
        return [];
    }
    const body = bodyRef.current;
    if (!body) {
        return [];
    }
    const bodyBox = body.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const current = col.getCached(id);
    if (!current) {
        return [];
    }
    const parent = node.offsetParent;
    if (!parent) {
        return [];
    }
    const pTop = parent.getBoundingClientRect().top;
    if (local.isExpanded(id) && current.children.length) {
        return [
            {
                parent,
                top: bodyBox.top,
                height: bodyBox.height / 2,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'before', path: childPath },
            },
            {
                parent,
                top: bodyBox.top + bodyBox.height / 2,
                height: bodyBox.height,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'child', path: childPath },
            },
            {
                parent,
                top: box.bottom - 10,
                height: box.height,
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
                top: bodyBox.top,
                height: bodyBox.height / 2,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'before', path: childPath },
            },
            // below
            {
                parent,
                top: bodyBox.top + bodyBox.height / 2,
                height: bodyBox.height / 2,
                left: bodyBox.left,
                width: bodyBox.width,
                dest: { type: 'after', path: childPath },
            },
        ];
    }
    // return [];
};

// export const RootItem = ({
//     path,
//     id,
//     client,
//     local,
//     registerDragTargets,
//     onDragStart,
// }: {
//     path: Array<string>,
//     id: string,
//     client: Client<*>,
//     local: LocalClient,
//     onDragStart: (MouseEvent, Array<string>) => void,
//     registerDragTargets: (string, ?(Array<string>) => Array<DragTarget>) => void,
// }) => {
//     return 'Hi';
// };

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
};

const Item = ({ path, id, client, local, registerDragTargets, onDragStart }: Props) => {
    const [col, item] = useItem<ItemT, *>(React, client, 'items', id);
    const childPath = React.useMemo(() => path.concat([id]), [path, id]);
    const bodyRef = React.useRef(null);
    const [tick, setTick] = React.useState(0);

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
    const collapsible = path.length > 0 && item.children.length > 0;
    const collapsed = collapsible && !local.isExpanded(id);
    return (
        <div
            ref={(node) => {
                if (node) {
                    registerDragTargets(
                        id,
                        dragHandler({
                            node,
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
                }}
                ref={(node) => (bodyRef.current = node)}
            >
                <div
                    onMouseDown={(evt) => onDragStart(evt, childPath)}
                    onClick={
                        collapsible
                            ? () => {
                                  console.log('click');
                                  local.setExpanded(id, collapsed);
                                  setTick(tick + 1);
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
                <QuillEditor
                    css={{
                        flex: 1,
                        border: '1px dashed transparent',
                        ...(length(item.body) <= 1 ? { borderBottomColor: 'currentColor' } : null),
                    }}
                    innerRef={(node) => local.register(id, node)}
                    value={item.body}
                    actions={itemActions({ client, col, path, id, local })}
                    getStamp={client.getStamp}
                    onChange={(delta) => {
                        // console.log('Ok', delta);
                        col.applyRichTextDelta(id, ['body'], delta);
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
                {local.isExpanded(id) || path.length === 0
                    ? item.children.map((id) => (
                          <MemoItem
                              path={childPath}
                              id={id}
                              key={id}
                              client={client}
                              local={local}
                              onDragStart={onDragStart}
                              registerDragTargets={registerDragTargets}
                          />
                      ))
                    : null}
            </div>
        </div>
    );
};

const MemoItem = React.memo<Props>(Item);

export default MemoItem;
