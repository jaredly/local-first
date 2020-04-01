// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { type Collection } from '../../../packages/client-bundle';

import { type CardT, type TagT, type ScaleT, colors } from './types';

const ScaleSummary = ({ scale }: { scale: ScaleT }) => {
    return <div css={styles.item}>{scale.title}</div>;
};

const Scale = ({
    scale,
    cards,
    cardsCol,
    setKey,
    clearKey,
}: {
    scale: ScaleT,
    cards: Array<CardT>,
    cardsCol: Collection<CardT>,
    setKey: ((KeyboardEvent) => ?boolean) => void,
    clearKey: () => void,
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

    return (
        <div
            css={styles.item}
            onMouseOver={() => {
                setKey(evt => {
                    const n = parseInt(evt.key);
                    if (!isNaN(n) && n >= scale.min && n <= scale.max) {
                        const value =
                            numWithValue === 1 && values[n - scale.min] === cards.length ? null : n;
                        cards.forEach(card =>
                            cardsCol.setAttribute(card.id, ['scales', scale.id], value),
                        );
                    }
                });
            }}
            onMouseOut={() => {
                clearKey();
            }}
        >
            {scale.title}
            <div css={{ display: 'flex', justifyContent: 'space-between' }}>
                {values.map((v, i) => (
                    <div
                        onClick={() => {
                            const n = i + scale.min;
                            const value =
                                numWithValue === 1 && values[n - scale.min] === cards.length
                                    ? null
                                    : n;
                            cards.forEach(card =>
                                cardsCol.setAttribute(card.id, ['scales', scale.id], value),
                            );
                            // cards.forEach(card =>
                            //     cardsCol.setAttribute(card.id, ['scales', scale.id], i + scale.min),
                            // );
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
                            v ? { backgroundColor: '#0af' } : {},
                        ]}
                    >
                        {i + scale.min}
                        {cards.length !== 1 ? (
                            <div css={{ position: 'absolute', fontSize: '60%' }}>{v}</div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

const TagsUI = ({
    cards,
    cardsCol,
    tagsCol,
    scalesCol,
    tags,
    scales,
    selection,
    setKey,
    clearKey,
}: {
    cardsCol: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    selection: { [key: string]: boolean },
    setKey: ((KeyboardEvent) => ?boolean) => void,
    clearKey: () => void,
}) => {
    const allScales = Object.keys(scales)
        .sort()
        .map(key => scales[key]);
    const allTags = Object.keys(tags)
        .sort()
        .map(key => tags[key]);

    const selectedCards = Object.keys(selection).map(k => cards[k]);

    if (!Object.keys(selection)) {
        return (
            <div css={styles.container}>
                <div css={styles.header}>Scales</div>
                {allScales.map(scale => (
                    <ScaleSummary scale={scale} key={scale.id} />
                ))}
                <div css={styles.header}>Tags</div>
                {allTags.map(tag => (
                    <div css={styles.item} key={tag.id}>
                        {tag.title}
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div css={styles.container}>
            <div css={styles.header}>Scales</div>
            {allScales.map(scale => (
                <Scale
                    setKey={setKey}
                    clearKey={clearKey}
                    cardsCol={cardsCol}
                    scale={scale}
                    key={scale.id}
                    cards={selectedCards}
                />
            ))}
            <div css={styles.header}>Tags</div>
            {allTags.map(tag => (
                <div css={styles.item} key={tag.id}>
                    {tag.title}
                </div>
            ))}
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
    header: { fontWeight: 'bold', padding: '4px 8px' },
    container: {
        fontSize: 24,
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'white',
        boxShadow: '0 0 5px #aaa',
    },
};

export default TagsUI;
