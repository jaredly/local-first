// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import { useCollection } from '../../../packages/client-react';

import { type Client, type SyncStatus } from '../../../packages/client-bundle';

import WhiteboardScreen from './screens/WhiteboardScreen';
import FlashcardMode from './screens/FlashcardMode';
import SortMode from './screens/SortModeMergeSort';
import Welcome from './Welcome';

import {
    type TagT,
    TagSchema,
    type ScaleT,
    ScaleSchema,
    type CommentT,
    CommentSchema,
    type CardT,
    CardSchema,
    normalizedRect,
    posDiff,
    rectIntersect,
    BOUNDS,
} from './types';

import {
    makeDefaultCards,
    makeDefaultHeadings,
    makeDefaultTags,
    makeDefaultScales,
} from './defaults';
import { type Collection } from '../../../packages/client-bundle';

const Main = ({ client }: { client: Client<SyncStatus> }) => {
    const [col, cards] = useCollection<CardT, SyncStatus>(React, client, 'cards');
    const [tagsCol, tags] = useCollection<TagT, SyncStatus>(React, client, 'tags');
    const [scalesCol, scales] = useCollection<ScaleT, SyncStatus>(React, client, 'scales');
    const [commentsCol, comments] = useCollection<CommentT, SyncStatus>(React, client, 'comments');

    // const [flashcard, setFlashcard] = React.useState(true);
    const [screen, setScreen] = React.useState('flashcard');

    if (!Object.keys(cards).length) {
        return (
            <Welcome
                onStart={() => {
                    makeDefaultTags(client.getStamp).forEach(tag => {
                        tagsCol.save(tag.id, tag);
                    });
                    makeDefaultScales(client.getStamp).forEach(scale => {
                        scalesCol.save(scale.id, scale);
                    });
                    makeDefaultHeadings(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                    makeDefaultCards(client.getStamp).forEach(card => {
                        col.save(card.id, card);
                    });
                }}
            />
        );
    }

    if (screen === 'flashcard') {
        return (
            <FlashcardMode
                cards={cards}
                col={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                onDone={() => setScreen('whiteboard')}
                genId={client.getStamp}
            />
        );
    } else if (screen === 'sort') {
        return (
            <SortMode
                cards={cards}
                col={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
                onDone={() => setScreen('whiteboard')}
                genId={client.getStamp}
            />
        );
    } else {
        return (
            <WhiteboardScreen
                setFlashcard={() => setScreen('flashcard')}
                client={client}
                cards={cards}
                col={col}
                tags={tags}
                tagsCol={tagsCol}
                scales={scales}
                scalesCol={scalesCol}
            />
        );
    }
};

export default Main;
