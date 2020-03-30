// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';

import { type Schema, type Collection } from '../../../packages/client-bundle';
import {
    type pos,
    type rect,
    type SettingsT,
    type CardT,
    CardSchema,
    SettingsSchema,
    evtPos,
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    rectIntersect,
    fromScreen,
    clamp,
    colors,
    BOUNDS,
} from './types';

import type { Action } from '.';

type Props = {
    offset: ?pos,
    card: CardT,
    col: Collection<CardT>,
    panZoom: { current: { pan: pos, zoom: number } },
    selected: boolean,
    hovered: ?boolean,
    dispatch: Action => void,
    dragRef: { current: boolean },
    currentHover: { current: ?string },
    selectAllWith: ((CardT) => boolean) => void,
};

const fontSizes = ['1.1em', '1.5em', '1.7em', '2em', '2.2em'];

const Card = ({
    offset,
    card,
    col,
    selected,
    hovered,
    dispatch,
    dragRef,
    panZoom,
    selectAllWith,
    currentHover,
}: Props) => {
    const pos = offset
        ? clamp(addPos(card.position, offset), card.size, BOUNDS)
        : card.position;
    const [editing, setEditing] = React.useState(null);
    return (
        <div
            key={card.id}
            onMouseOver={evt => (currentHover.current = card.id)}
            onMouseOut={evt => {
                if (currentHover.current === card.id) {
                    currentHover.current = null;
                }
            }}
            onDoubleClick={evt => {
                if (evt.metaKey || evt.shiftKey) {
                    return;
                }
                setEditing({
                    title: card.title,
                    description: card.description,
                });
            }}
            style={{
                top: pos.y,
                left: pos.x,
                width: card.size.x,
                height: card.size.y,
                backgroundColor: selected || hovered ? 'aliceblue' : undefined,
            }}
            css={[
                {
                    position: 'absolute',
                    cursor: 'pointer',
                    padding: '4px 12px',
                    ':hover': {
                        boxShadow: '0 0 5px #0af',
                    },
                },
                card.header == null
                    ? {
                          boxShadow: '0 0 3px #ccc',
                          backgroundColor: 'white',
                      }
                    : {
                          fontSize:
                              fontSizes[
                                  Math.min(card.header, fontSizes.length - 1)
                              ],
                          backgroundColor: 'transparent',
                      },
            ]}
            onMouseDown={evt => {
                evt.preventDefault();
                const screenPos = evtPos(evt);
                const pos = fromScreen(
                    screenPos,
                    panZoom.current.pan,
                    panZoom.current.zoom,
                );
                dispatch({
                    type: 'start_drag',
                    pos,
                    screenPos,
                });
                dragRef.current = false;
                // downPos.current = pos;
                if (!selected) {
                    dispatch(
                        evt.metaKey || evt.shiftKey
                            ? {
                                  type: 'add_selection',
                                  selection: { [card.id]: true },
                              }
                            : {
                                  type: 'replace_selection',
                                  selection: { [card.id]: true },
                              },
                    );
                } else if (evt.metaKey || evt.shiftKey) {
                    dispatch({
                        type: 'remove_selection',
                        selection: { [card.id]: true },
                    });
                }
                evt.stopPropagation();
            }}
            onClick={evt => {
                evt.stopPropagation();
                if (dragRef.current) {
                    return;
                }
                if (selected && !evt.metaKey && !evt.shiftKey) {
                    dispatch({
                        type: 'replace_selection',
                        selection: { [card.id]: true },
                    });
                }
            }}
        >
            <div
                style={{
                    fontWeight: 'bold',
                    marginBottom: 4,
                    textAlign: 'center',
                }}
            >
                {editing ? (
                    <input
                        onMouseDown={evt => evt.stopPropagation()}
                        onClick={evt => evt.stopPropagation()}
                        value={editing.title}
                        onChange={evt =>
                            setEditing({ ...editing, title: evt.target.value })
                        }
                        style={{
                            fontWeight: 'inherit',
                            fontFamily: 'inherit',
                            width: '100%',
                        }}
                    />
                ) : (
                    card.title
                )}
            </div>
            <div
                style={{
                    fontSize: '80%',
                    textAlign: card.header != null ? 'center' : 'left',
                }}
            >
                {/* {card.description} */}
                {editing ? (
                    <input
                        onMouseDown={evt => evt.stopPropagation()}
                        onClick={evt => evt.stopPropagation()}
                        value={editing.description}
                        onChange={evt =>
                            setEditing({
                                ...editing,
                                description: evt.target.value,
                            })
                        }
                        style={{
                            fontWeight: 'inherit',
                            fontFamily: 'inherit',
                            width: '100%',
                        }}
                    />
                ) : (
                    card.description
                )}
            </div>
            {editing != null ? (
                <div
                    onMouseDown={evt => evt.stopPropagation()}
                    onClick={evt => evt.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            col.setAttribute(card.id, ['title'], editing.title);
                            col.setAttribute(
                                card.id,
                                ['description'],
                                editing.description,
                            );
                            setEditing(null);
                        }}
                    >
                        Save
                    </button>
                    <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
            ) : null}
            <div
                css={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                }}
            >
                {card.number != null ? (
                    <span
                        css={tagStyle}
                        style={createTagStyle(card.number + '')}
                        onClick={evt => {
                            evt.stopPropagation();
                            selectAllWith(
                                c =>
                                    c.number === card.number &&
                                    c.header === card.header,
                            );
                        }}
                    >
                        {card.number}
                    </span>
                ) : null}
                {card.letter != null ? (
                    <span
                        css={tagStyle}
                        style={createTagStyle(card.letter)}
                        onClick={evt => {
                            evt.stopPropagation();
                            selectAllWith(
                                c =>
                                    c.letter === card.letter &&
                                    c.header === card.header,
                            );
                        }}
                    >
                        {card.letter.toUpperCase()}
                    </span>
                ) : null}
            </div>
        </div>
    );
};

export const tagStyle = {
    display: 'inline-block',
    marginLeft: 4,
    padding: '2px 4px',
    fontSize: '80%',
    borderRadius: 4,
    // backgroundColor: 'white',
};

export const createTagStyle = (tag: string) => {
    return tagStyles[tag];
};

// 36. there are 10 colors. 4 diff styles.
// the number in the color
// single border
// background color
// black background
const digits = '0123456789';
const letters = 'abcdefghijklmnopqrstuvwxyz';
export const tagStyles = {};
[...(letters + digits)].forEach((tag, i) => {
    if (i < 10) {
        tagStyles[tag] = {
            color: colors[i],
            fontWeight: 'bold',
            borderColor: 'black',
            borderWidth: 1,
            borderStyle: 'solid',
        };
    } else if (i < 20) {
        tagStyles[tag] = {
            backgroundColor: colors[i - 10],
            color: 'white',
            fontWeight: 'bold',
        };
    } else if (i < 30) {
        tagStyles[tag] = {
            borderColor: colors[i - 20],
            borderWidth: 2,
            borderStyle: 'solid',
        };
    } else {
        tagStyles[tag] = {
            borderColor: colors[i - 30],
            borderWidth: 2,
            borderStyle: 'solid',
            color: 'white',
            backgroundColor: '#666',
        };
    }
});

export default React.memo<Props>(Card);
