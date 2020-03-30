// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle, tagName } from './Card';

import { type Schema, type Collection } from '../../../packages/client-bundle';
import { type SettingsT, type CardT, SettingsSchema } from './types';

const Key = ({
    cards,
    settings,
    settingsCol,
}: {
    cards: { [key: string]: CardT },
    settings: ?SettingsT,
    settingsCol: Collection<SettingsT>,
}) => {
    const tagsByUse = React.useMemo(() => {
        const tagsByUse = {};
        Object.keys(cards).forEach(id => {
            const card = cards[id];
            if (card.letter != null) {
                tagsByUse[card.letter] = (tagsByUse[card.letter] || 0) + 1;
            }
            if (card.number != null) {
                tagsByUse[card.number + ''] =
                    (tagsByUse[card.number + ''] || 0) + 1;
            }
        });
        return tagsByUse;
    }, [cards]);

    return (
        <div
            onKeyDown={evt => evt.stopPropagation()}
            onMouseDown={evt => evt.stopPropagation()}
            onClick={evt => evt.stopPropagation()}
        >
            {Object.keys(tagsByUse).map(tag => (
                <Tag
                    key={tag}
                    tag={tag}
                    count={tagsByUse[tag]}
                    label={
                        settings && settings.tagNames[tag]
                            ? settings.tagNames[tag]
                            : null
                    }
                    setLabel={label => {
                        if (settings) {
                            settingsCol.setAttribute(
                                'default',
                                ['tagNames', tag],
                                label,
                            );
                        } else {
                            settingsCol.save('default', {
                                title: '',
                                tagNames: { [tag]: label },
                            });
                        }
                    }}
                />
            ))}
        </div>
    );
};

const Tag = ({ tag, count, label, setLabel }) => {
    const [editing, setEditing] = React.useState(null);
    return (
        <div
            style={{ display: 'flex', cursor: 'pointer' }}
            onClick={() => (editing === null ? setEditing(label || '') : null)}
        >
            <div
                style={{
                    width: '1.5em',
                    textAlign: 'right',
                    marginRight: 12,
                }}
            >
                {count}
            </div>
            <div
                css={[
                    tagStyle,
                    {
                        width: '1.5em',
                        textAlign: 'center',
                        display: 'inline-block',
                        marginRight: 12,
                    },
                ]}
                style={createTagStyle(tag)}
            >
                {tag.toUpperCase()}
            </div>
            {label && editing === null ? <div>{label}</div> : null}
            {editing != null ? (
                <input
                    value={editing}
                    autoFocus
                    placeholder={'Tag label'}
                    onClick={evt => evt.stopPropagation()}
                    onMouseDown={evt => evt.stopPropagation()}
                    onChange={evt => setEditing(evt.target.value)}
                    onKeyDown={evt => {
                        evt.stopPropagation();
                        if (evt.key === 'Enter' && editing.trim() != '') {
                            setLabel(editing);
                            setEditing(null);
                        }
                    }}
                    onBlur={() => {
                        if (editing.trim() != '') {
                            setLabel(editing);
                        }
                        setEditing(null);
                    }}
                />
            ) : null}
        </div>
    );
};

export default Key;
