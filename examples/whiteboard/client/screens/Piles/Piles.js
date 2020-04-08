// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../../types';
import { useSpring, animated, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import { Colors } from '../../Styles';
import { PILE_WIDTH, PILE_HEIGHT } from './consts';

const Piles = ({
    sort,
    onClick,
    onRef,
    hovered,
    selected,
}: {
    sort: SortT,
    onClick: (number) => void,
    onRef: (number, HTMLDivElement) => void,
    hovered: ?number,
    selected: ?number,
}) => {
    const pilesInOrder = Object.keys(sort.piles)
        .sort()
        .map((id) => ({ id, pile: sort.piles[+id] }));

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
            }}
        >
            {pilesInOrder.map(({ id, pile }, i) => (
                <div
                    key={i}
                    onClick={() => onClick(+id)}
                    ref={(node) => {
                        if (node) {
                            onRef(+id, node);
                        }
                    }}
                    style={{
                        outline: selected === +id ? `2px solid ${Colors.darkPink}` : null,
                    }}
                    css={{
                        padding: 8,
                        cursor: 'pointer',
                        textAlign: 'center',
                        ':hover': {
                            outline: `2px solid ${Colors.pink}`,
                        },
                    }}
                >
                    <div style={styles.title}>{pile.title}</div>
                    <div
                        style={{
                            backgroundColor: hovered == +id ? Colors.lightPink : null,
                            border: '1px solid #aaa',
                            width: PILE_WIDTH,
                            height: PILE_HEIGHT,
                            position: 'relative',
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

const styles = {
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
};

export default Piles;
