// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import parseColor from 'parse-color';

import { type Collection } from '../../../packages/client-bundle';

import { type CardT, type TagT, type ScaleT, colors } from './types';

const ScaleSummary = ({ scale }: { scale: ScaleT }) => {
    return <div css={styles.item}>{scale.title}</div>;
};

const Tag = ({
    tag,
    cards,
    cardsCol,
}: {
    tag: TagT,
    cards: Array<CardT>,
    cardsCol: Collection<CardT>,
}) => {
    const cardsWithout = cards.filter(card => card.tags[tag.id] == null);
    return (
        <div
            css={styles.item}
            style={{
                cursor: 'pointer',
                backgroundColor:
                    cardsWithout.length === 0
                        ? '#0af'
                        : cardsWithout.length === cards.length
                        ? null
                        : 'aliceblue',
            }}
            onClick={() => {
                if (!cardsWithout.length) {
                    cards.forEach(card => cardsCol.setAttribute(card.id, ['tags', tag.id], null));
                } else {
                    const time = Date.now();
                    cardsWithout.forEach(card =>
                        cardsCol.setAttribute(card.id, ['tags', tag.id], time),
                    );
                }
            }}
        >
            {tag.title}
        </div>
    );
};

const Scale = ({
    scale,
    cards,
    cardsCol,
    onClick,
}: {
    scale: ScaleT,
    cards: Array<CardT>,
    cardsCol: Collection<CardT>,
    onClick: () => void,
}) => {
    const values = [];
    let numWithValue = 0;
    for (let i = scale.min; i <= scale.max; i++) {
        values.push(0);
    }
    cards.forEach(card => {
        if (card.scales[scale.id] != null) {
            const at = card.scales[scale.id] - scale.min;
            if (values[at] === 0) {
                numWithValue += 1;
            }
            values[at] += 1;
        }
    });
    const color = parseColor(scale.color);
    const maxV = Math.max(1, ...values);

    return (
        <div
            css={styles.item}
            // tabIndex="0"
            // onKeyDown={evt => {
            //     if (+evt.key == evt.key) {
            //         const n = parseInt(evt.key);
            //         if (!isNaN(n) && n >= scale.min && n <= scale.max) {
            //             const value =
            //                 numWithValue === 1 && values[n - scale.min] === cards.length ? null : n;
            //             cards.forEach(card =>
            //                 cardsCol.setAttribute(card.id, ['scales', scale.id], value),
            //             );
            //         }
            //     }
            // }}
        >
            <div
                style={{
                    borderBottom: `2px solid ${scale.color}`,
                    marginBottom: 4,
                    cursor: 'pointer',
                }}
                onClick={() => onClick()}
            >
                {scale.title}
            </div>
            <div css={{ display: 'flex', justifyContent: 'space-between' }}>
                {values.map((v, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            const n = i + scale.min;
                            const value =
                                numWithValue === 1 && values[n - scale.min] === cards.length
                                    ? null
                                    : n;
                            cards.forEach(card =>
                                cardsCol.setAttribute(card.id, ['scales', scale.id], value),
                            );
                        }}
                        css={[
                            {
                                position: 'relative',
                                cursor: 'pointer',
                                flex: 1,
                                textAlign: 'center',
                                border: '2px solid transparent',
                                borderRadius: 4,
                                ':hover': {
                                    borderColor: '#0af',
                                },
                            },
                        ]}
                        style={
                            v
                                ? {
                                      backgroundColor: `rgba(${color.rgb[0]},${color.rgb[1]},${
                                          color.rgb[2]
                                      },${v / maxV})`,
                                  }
                                : null
                        }
                    >
                        {cards.length === 1 ? (
                            i + scale.min
                        ) : (
                            <React.Fragment>
                                <div
                                    css={{ position: 'absolute', fontSize: '60%', top: 0, left: 0 }}
                                >
                                    {i + scale.min}
                                </div>
                                {v}
                            </React.Fragment>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

type Props = {
    cardsCol: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    selection: { [key: string]: boolean },
    onFocusScale: ScaleT => void,
    setSelection: ({ [key: string]: boolean }) => void,
    genId: () => string,
};

const TagsUI = ({
    cards,
    cardsCol,
    tagsCol,
    scalesCol,
    tags,
    scales,
    selection,
    setSelection,
    onFocusScale,
    genId,
}: Props) => {
    const allScales = Object.keys(scales)
        .sort()
        .map(key => scales[key]);
    const allTags = Object.keys(tags)
        .sort()
        .map(key => tags[key]);

    const selectedIds = Object.keys(selection);
    const selectedCards = (selectedIds.length ? selectedIds : Object.keys(cards)).map(
        k => cards[k],
    );

    const [addingTag, setAddingTag] = React.useState(null);
    const [addingScale, setAddingScale] = React.useState(null);

    return (
        <div css={styles.container}>
            <div css={styles.header}>
                Scales
                <button
                    css={{ marginLeft: 16 }}
                    onClick={() => {
                        setAddingScale('');
                    }}
                >
                    +
                </button>
            </div>
            {allScales.map(scale => (
                <Scale
                    onClick={() => onFocusScale(scale)}
                    cardsCol={cardsCol}
                    scale={scale}
                    key={scale.id}
                    cards={selectedCards}
                />
            ))}
            {addingScale != null ? (
                <input
                    value={addingScale}
                    css={{
                        fontSize: 'inherit',
                    }}
                    autoFocus
                    onChange={evt => setAddingScale(evt.target.value)}
                    onBlur={() => setAddingScale(null)}
                    onKeyDown={evt => {
                        evt.stopPropagation();
                        if (evt.key === 'Escape') {
                            setAddingScale(null);
                        }
                        if (evt.key === 'Enter') {
                            if (addingScale.trim()) {
                                const id = genId();
                                scalesCol.save(id, {
                                    id,
                                    title: addingScale,
                                    color: colors[parseInt(Math.random() * colors.length)],
                                    min: 1,
                                    max: 5,
                                    createdDate: Date.now(),
                                });
                            }
                            setAddingScale(null);
                        }
                    }}
                />
            ) : null}
            <div css={styles.header}>
                Tags
                <button
                    css={{ marginLeft: 16 }}
                    onClick={() => {
                        setAddingTag('');
                    }}
                >
                    +
                </button>
            </div>
            {allTags.map(tag => (
                <Tag tag={tag} cards={selectedCards} cardsCol={cardsCol} key={tag.id} />
            ))}
            {addingTag != null ? (
                <input
                    value={addingTag}
                    css={{
                        fontSize: 'inherit',
                    }}
                    autoFocus
                    onChange={evt => setAddingTag(evt.target.value)}
                    onBlur={() => setAddingTag(null)}
                    onKeyDown={evt => {
                        evt.stopPropagation();
                        if (evt.key === 'Escape') {
                            setAddingTag(null);
                        }
                        if (evt.key === 'Enter') {
                            if (addingTag.trim()) {
                                const id = genId();
                                tagsCol.save(id, {
                                    id,
                                    title: addingTag,
                                    color: colors[parseInt(Math.random() * colors.length)],
                                    style: 'background',
                                    createdDate: Date.now(),
                                });
                            }
                            setAddingTag(null);
                        }
                    }}
                />
            ) : null}
        </div>
    );
};

const styles = {
    item: {
        padding: '4px 8px',
        ':hover': {
            backgroundColor: 'aliceblue',
        },
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        fontWeight: 'bold',
        padding: '4px 8px',
    },
    container: {
        // fontSize: 24,
        // position: 'absolute',
        // top: 12,
        // left: 12,
        zIndex: 1,
        backgroundColor: 'white',
        boxShadow: '0 0 5px #aaa',
    },
};

export default React.memo<Props>(TagsUI);
