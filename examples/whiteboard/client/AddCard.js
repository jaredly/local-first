// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Schema, type Collection } from '../../../packages/client-bundle';

const AddCard = ({ onAdd }: { onAdd: (string, string, ?number) => void }) => {
    const [adding, setAdding] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [header, setHeader] = React.useState(null);
    return (
        <div>
            <button onClick={() => setAdding(true)}>+ Card</button>
            {adding ? (
                <div style={styles.addCardPopover}>
                    <strong>
                        Add a {header === null ? 'normal' : 'header'} card
                    </strong>
                    <button
                        onClick={() => setHeader(header === null ? 1 : null)}
                    >
                        {header !== null ? 'Header card' : 'Normal card'}
                    </button>
                    <input
                        style={{ display: 'block' }}
                        onChange={evt => setTitle(evt.target.value)}
                        value={title}
                        placeholder="Title"
                    />
                    <input
                        style={{ display: 'block' }}
                        onChange={evt => setDescription(evt.target.value)}
                        value={description}
                        placeholder="Description"
                    />
                    <button
                        onClick={() => {
                            onAdd(title, description, header);
                            setAdding(false);
                            setTitle('');
                            setDescription('');
                        }}
                    >
                        Save
                    </button>
                    <button
                        onClick={() => {
                            setAdding(false);
                            setTitle('');
                            setDescription('');
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : null}
        </div>
    );
};

const styles = {
    addCardPopover: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 300,
        height: 200,
        marginLet: -150,
        marginTop: -100,
        backgroundColor: 'white',
        margin: 32,
        boxShadow: '0 0 5px #666',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
};

export default AddCard;
