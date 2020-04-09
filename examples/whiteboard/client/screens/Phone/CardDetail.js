// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../../../packages/client-bundle';
import { type CardT, type SortT, colors } from '../../types';
import { useSpring, animated, interpolate } from 'react-spring';
import { useDrag } from 'react-use-gesture';
import { Colors } from '../../Styles';

const Card = ({ card, cardsCol }) => {
    const [editing, setEditing] = React.useState(null);
    if (editing) {
        return (
            <div css={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
                <input
                    css={{
                        fontSize: 24,
                        fontWeight: 'inherit',
                        marginBottom: 16,
                        padding: 3,
                        border: 'none',
                        borderBottom: '1px solid #ccc',
                    }}
                    value={editing.title}
                    placeholder="Title"
                    onChange={(evt) => setEditing({ ...editing, title: evt.target.value })}
                />
                <textarea
                    css={{
                        fontSize: 20,
                        fontWeight: 'inherit',
                        marginBottom: 16,
                        border: '1px solid #ccc',
                        padding: 3,
                    }}
                    value={editing.description}
                    placeholder="Description"
                    onChange={(evt) => setEditing({ ...editing, description: evt.target.value })}
                />
                <div css={{ fontSize: '80%', color: '#555', marginBottom: 8 }}>
                    This will change the card's title and description across all sorts.
                </div>
                <div>
                    <button
                        onClick={() => {
                            if (editing.title !== card.title) {
                                cardsCol.setAttribute(card.id, ['title'], editing.title);
                            }
                            if (editing.description !== card.description) {
                                cardsCol.setAttribute(
                                    card.id,
                                    ['description'],
                                    editing.description,
                                );
                            }
                            setEditing(null);
                        }}
                    >
                        Save
                    </button>
                    <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
            </div>
        );
    }
    return (
        <div css={{ padding: 12 }}>
            <div
                css={{
                    fontSize: 24,
                    marginBottom: 16,
                }}
            >
                {card.title}
            </div>
            <div
                css={{
                    fontSize: 20,
                    marginBottom: 16,
                }}
            >
                {card.description}
            </div>
            <button
                onClick={() => setEditing({ title: card.title, description: card.description })}
            >
                Edit
            </button>
        </div>
    );
};

const CardDetail = ({ card, cardsCol, comments, commentsCol, sort, onClose }: *) => {
    const applicableComments = React.useMemo(() => {
        return Object.keys(comments)
            .filter((k) => comments[k].card === card.id && comments[k].sort === sort.id)
            .map((k) => comments[k])
            .sort((a, b) => b.createdDate - a.createdDate);
    }, [comments, card.id]);
    const [newText, setNewText] = React.useState('');
    return (
        <div css={styles.container}>
            <button onClick={onClose}>Close</button>
            <Card card={card} cardsCol={cardsCol} />
            <div css={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div css={{ fontWeight: 'bold', fontSize: '80%', margin: 8 }}>Comments</div>
                <div css={{ padding: 12, flex: 1, overflow: 'auto' }}>
                    {applicableComments.map((comment) => (
                        <div
                            key={comment.id}
                            css={{
                                borderBottom: '1px solid #ccc',
                                paddingBottom: 8,
                                marginBottom: 8,
                            }}
                        >
                            <div css={{ fontSize: '80%', color: '#555', marginBottom: 4 }}>
                                {relativeTime(comment.createdDate)}
                            </div>
                            <div>{comment.text}</div>
                        </div>
                    ))}
                    {applicableComments.length === 0 ? (
                        <div css={{ fontStyle: 'italic', margin: 8 }}>No comments</div>
                    ) : null}
                </div>
                <div css={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <textarea
                        value={newText}
                        css={{
                            height: 200,
                            fontSize: 16,
                            fontWeight: 'inherit',
                            padding: 8,
                            borderTop: '1px solid #aaa',
                        }}
                        onChange={(evt) => setNewText(evt.target.value)}
                    />
                    <button
                        css={{
                            fontWeight: 'inherit',
                            padding: '12px 16px',
                            fontSize: 24,
                            backgroundColor: Colors.pink,
                            cursor: 'pointer',
                        }}
                        onClick={() => {
                            if (newText.trim() === '') {
                                return;
                            }
                            const id = sort.id + '>' + card.id + '>' + commentsCol.genId();
                            commentsCol.save(id, {
                                id,
                                card: card.id,
                                sort: sort.id,
                                parentComment: null,
                                text: newText,
                                authorId: 'unknown',
                                createdDate: Date.now(),
                                deleted: false,
                            });
                            setNewText('');
                        }}
                    >
                        Add Comment
                    </button>
                </div>
            </div>
        </div>
    );
};

const atMorning = (d) => {
    d.setHours(0, 0, 0, 0);
    return d;
};

const relativeTime = (time) => {
    const now = Date.now();
    const thisMorning = atMorning(new Date());
    const yesterdayMorning = atMorning(new Date(thisMorning.getTime() - 3600 * 1000));
    if (time > thisMorning.getTime()) {
        return new Date(time).toLocaleTimeString();
    }
    if (time > yesterdayMorning.getTime()) {
        return 'Yesterday, ' + new Date(time).toLocaleTimeString();
    }
    return new Date(time).toLocaleDateString();
};

const styles = {
    container: {
        overflow: 'hidden',
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
};
export default CardDetail;
