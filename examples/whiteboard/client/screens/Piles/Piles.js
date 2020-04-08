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
                flexWrap: 'wrap',
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
                    <div style={styles.title}>
                        {pile.title}
                        <span
                            css={{
                                display: 'inline-block',
                                padding: '2px 4px',
                                marginLeft: 4,
                                backgroundColor: '#ccc',
                                border: '1px solid #aaa',
                                borderRadius: 3,
                                fontSize: '80%',
                                color: '#555',
                                textShadow: '1px 1px white',
                                boxShadow: '1px 1px 2px #aaa',
                            }}
                        >
                            {+id + 1}
                        </span>
                    </div>
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
