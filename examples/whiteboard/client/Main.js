// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import { useCollection } from '../../../packages/client-react';

import { type Client, type SyncStatus } from '../../../packages/client-bundle';

import PilesMode from './screens/AnimatedPiles';
import HomePage from './screens/HomePage';

import {
    // type TagT,
    // TagSchema,
    // type ScaleT,
    // ScaleSchema,
    type SortT,
    type CommentT,
    type CardT,
    normalizedRect,
    posDiff,
    rectIntersect,
    BOUNDS,
} from './types';

import { type Collection } from '../../../packages/client-bundle';

const Main = ({ client }: { client: Client<SyncStatus> }) => {
    const [col, cards] = useCollection<CardT, SyncStatus>(React, client, 'cards');
    const [sortsCol, sorts] = useCollection<SortT, SyncStatus>(React, client, 'sorts');
    // const [tagsCol, tags] = useCollection<TagT, SyncStatus>(React, client, 'tags');
    // const [scalesCol, scales] = useCollection<ScaleT, SyncStatus>(React, client, 'scales');
    const [commentsCol, comments] = useCollection<CommentT, SyncStatus>(React, client, 'comments');

    // const [flashcard, setFlashcard] = React.useState(true);
    const [screen, setScreen] = React.useState('piles');

    const [sort, setSort] = React.useState(null);

    if (sort) {
        return (
            <PilesMode
                cards={cards}
                col={col}
                onDone={() => setScreen('whiteboard')}
                genId={client.getStamp}
                sort={sort}
                sortsCol={sortsCol}
            />
        );
    } else {
        return (
            <HomePage
                openSort={(sort) => setSort(sort)}
                genId={client.getStamp}
                cards={cards}
                col={col}
                sorts={sorts}
                sortsCol={sortsCol}
            />
        );
    }
};

export default Main;
