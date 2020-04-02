// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';

import parseColor from 'parse-color';

import { type Schema, type Collection } from '../../../packages/client-bundle';
import {
    type pos,
    type rect,
    type TagT,
    type ScaleT,
    type CardT,
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

import type { Action } from './whiteboard/state2';
import type { SelectionAction } from './Main';

type Props = {
    offset: ?pos,
    card: CardT,
    col: Collection<CardT>,
    panZoom: { current: { pan: pos, zoom: number } },
    tags: { [key: string]: TagT },
    scales: { [key: string]: ScaleT },
    selected: boolean,
    hovered: ?boolean,
    dispatch: Action => void,
    dispatchSelection: SelectionAction => void,
    dragRef: { current: boolean },
    // currentHover: { current: ?string },
    selectAllWith: ((CardT) => boolean) => void,
};

const fontSizes = ['1.1em', '1.5em', '1.7em', '2em', '2.2em'];

// export const tagName = (settings: ?SettingsT, tag: string) => {
//     if (settings && settings.tagNames[tag]) {
//         return settings.tagNames[tag];
//     }
//     return tag.toUpperCase();
// };

const colorWithAlpha = (color, alpha) =>
    `rgba(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]},${alpha})`;

const Card = ({
    offset,
    card,
    col,
    selected,
    hovered,
    dispatch,
    dispatchSelection,
    dragRef,
    panZoom,
    tags,
    scales,
    selectAllWith,
}: // currentHover,
Props) => {
    const pos = offset ? clamp(addPos(card.position, offset), card.size, BOUNDS) : card.position;
    const [editing, setEditing] = React.useState(null);
    return (
        <div
            key={card.id}
            // onMouseOver={evt => (currentHover.current = card.id)}
            // onMouseOut={evt => {
            //     if (currentHover.current === card.id) {
            //         currentHover.current = null;
            //     }
            // }}
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
                display: 'flex',
                flexDirection: 'column',
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
                          fontSize: fontSizes[Math.min(card.header, fontSizes.length - 1)],
                          backgroundColor: 'transparent',
                      },
            ]}
            onMouseDown={evt => {
                evt.preventDefault();
                const screenPos = evtPos(evt);
                const pos = fromScreen(screenPos, panZoom.current.pan, panZoom.current.zoom);
                dispatch({
                    type: 'start_drag',
                    pos,
                    screenPos,
                });
                dragRef.current = false;
                // downPos.current = pos;
                if (!selected) {
                    dispatchSelection(
                        evt.metaKey || evt.shiftKey
                            ? {
                                  type: 'add',
                                  selection: { [card.id]: true },
                              }
                            : {
                                  type: 'replace',
                                  selection: { [card.id]: true },
                              },
                    );
                } else if (evt.metaKey || evt.shiftKey) {
                    dispatchSelection({
                        type: 'remove',
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
                    dispatchSelection({
                        type: 'replace',
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
                        onChange={evt => setEditing({ ...editing, title: evt.target.value })}
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
                            col.setAttribute(card.id, ['description'], editing.description);
                            setEditing(null);
                        }}
                    >
                        Save
                    </button>
                    <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
            ) : null}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex' }}>
                {Object.keys(card.scales)
                    .filter(sid => card.scales[sid] != null)
                    .sort()
                    .map(sid => scales[sid])
                    .filter(Boolean)
                    .map(scale => (
                        <div
                            key={scale.id}
                            onClick={evt => {
                                evt.stopPropagation();
                                selectAllWith(c => c.scales[scale.id] === card.scales[scale.id]);
                            }}
                            css={{
                                padding: '4px 8px',
                                borderRadius: 3,
                            }}
                            style={{
                                backgroundColor: colorWithAlpha(
                                    parseColor(scale.color),
                                    ((card.scales[scale.id] - scale.min) /
                                        (scale.max - scale.min)) *
                                        0.5 +
                                        0.5,
                                ),
                            }}
                        >
                            {card.scales[scale.id]}
                        </div>
                    ))}
            </div>
        </div>
    );
};

export const tagStyle = {
    display: 'inline-block',
    // marginLeft: 4,
    padding: '0px 4px',
    fontSize: '70%',
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
