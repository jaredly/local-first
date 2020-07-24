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

const Item = ({
    path,
    id,
    client,
    local,
    registerDragTargets,
    onDragStart,
}: {
    path: Array<string>,
    id: string,
    client: Client<*>,
    local: LocalClient,
    onDragStart: (MouseEvent, string) => void,
    registerDragTargets: (string, ?() => Array<DragTarget>) => void,
}) => {
    const [col, item] = useItem<ItemT, *>(React, client, 'items', id);
    const childPath = path.concat([id]);

    if (item === false) {
        return null; // loading
    }
    if (item == null) {
        return 'Item does not exist';
    }
    return (
        <div
            ref={(node) => {
                if (node) {
                    registerDragTargets(id, () => {
                        return [];
                    });
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
            >
                <div
                    onMouseDown={(evt) => onDragStart(evt, id)}
                    css={{
                        width: '2em',
                        alignSelf: 'stretch',
                        cursor: 'pointer',
                        ':hover': {
                            backgroundColor: 'rgba(255,255,255,0.1)',
                        },
                    }}
                />
                <QuillEditor
                    css={{
                        flex: 1,
                    }}
                    innerRef={(node) => local.register(id, node)}
                    value={item.body}
                    actions={{
                        onUp() {
                            const up = navigation.goUp(col, path, id);
                            if (up != null) {
                                local.setFocus(up);
                                return true;
                            }
                        },
                        onDown() {
                            const down = navigation.goDown(col, path, id);
                            if (down) {
                                local.setFocus(down);
                                return true;
                            }
                        },
                        onEnter() {
                            console.log('enter');
                            const current = col.getCached(id);
                            if (!current) return;
                            if (current.children.length) {
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
                            navigation.createChild(client, col, path, id);
                        },
                    }}
                    getStamp={client.getStamp}
                    onChange={(body) => col.applyRichTextDelta(id, ['body'], body)}
                    siteId={client.sessionId}
                />
            </div>
            <div
                style={{
                    paddingLeft: '2em',
                }}
            >
                {item.children.map((id) => (
                    <Item
                        path={childPath}
                        id={id}
                        key={id}
                        client={client}
                        local={local}
                        onDragStart={onDragStart}
                        registerDragTargets={registerDragTargets}
                    />
                ))}
            </div>
        </div>
    );
};

export default Item;
