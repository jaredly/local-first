// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';

import { type Schema, type Collection } from '../../../packages/client-bundle';
import {
    type pos,
    type rect,
    type CardT,
    CardSchema,
    evtPos,
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    rectIntersect,
} from './types';

import type { Action } from './';

type Props = {
    offset: ?pos,
    card: CardT,
    col: Collection<CardT>,
    selected: boolean,
    hovered: ?boolean,
    dispatch: Action => void,
    dragRef: { current: boolean },
};

const Card = ({
    offset,
    card,
    col,
    selected,
    hovered,
    dispatch,
    dragRef,
}: Props) => {
    const pos = offset ? addPos(card.position, offset) : card.position;
    // const downPos = React.useRef(null);
    return (
        <div
            key={card.id}
            style={{
                top: pos.y,
                left: pos.x,
                width: card.size.x,
                height: card.size.y,
                backgroundColor: selected || hovered ? 'aliceblue' : 'white',
            }}
            css={{
                padding: '4px 12px',
                boxShadow: '0 0 3px #ccc',
                position: 'absolute',
            }}
            onMouseDown={evt => {
                const pos = evtPos(evt);
                dispatch({
                    type: 'start_drag',
                    pos,
                });
                dragRef.current = false;
                // downPos.current = pos;
                if (!selected) {
                    dispatch(
                        evt.metaKey
                            ? {
                                  type: 'add_selection',
                                  selection: { [card.id]: true },
                              }
                            : {
                                  type: 'replace_selection',
                                  selection: { [card.id]: true },
                              },
                    );
                } else if (evt.metaKey) {
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
                if (selected && !evt.metaKey) {
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
                {card.title}
            </div>
            <div
                style={{
                    fontSize: '80%',
                }}
            >
                {card.description}
            </div>
        </div>
    );
};
export default React.memo<Props>(Card);
