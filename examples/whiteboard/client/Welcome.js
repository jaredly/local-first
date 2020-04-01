// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

const Welcome = ({ onStart }: { onStart: () => void }) => {
    return (
        <div
            css={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <h1>Welcome to the Miller Card Sort!</h1>
            <h4>Instructions</h4>
            <ul>
                <li>Drag cards around</li>
                <li>Hover a card &amp; press a number or letter key to "tag" the card</li>
                <li>Click a tag to select all cards with that tag</li>
                <li>
                    use shift+1, shift+2, and shift+3 to organize selected cards into 1, 2 or 3
                    columns
                </li>
            </ul>
            <button
                css={{
                    marginTop: 32,
                    fontSize: '2em',
                    border: 'none',
                    backgroundColor: '#0af',
                    padding: '8px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                }}
                onClick={onStart}
            >
                Click here to get started
            </button>
        </div>
    );
};
export default Welcome;
