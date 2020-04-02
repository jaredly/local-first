// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import {
    createInMemoryDeltaClient,
    createPersistedBlobClient,
} from '../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../packages/idb/src/delta-mem';
import { useCollection } from '../../../packages/client-react';

import AddCard from './AddCard';

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, DEFAULT_MARGIN } from './defaults';

import {
    type Schema,
    type Collection,
    type Client,
    type SyncStatus,
} from '../../../packages/client-bundle';

import {
    type pos,
    type rect,
    type TagT,
    TagSchema,
    type ScaleT,
    ScaleSchema,
    type CommentT,
    CommentSchema,
    type CardT,
    CardSchema,
    evtPos,
    addPos,
    normalizedRect,
    posDiff,
    absMax,
    clamp,
    rectIntersect,
    toScreen,
    fromScreen,
    BOUNDS,
} from './types';

import { type State, type Action } from './whiteboard/state';

const Hud = ({
    setFlashcard,
    client,
    col,
}: {
    setFlashcard: boolean => void,
    client: Client<SyncStatus>,
    col: Collection<CardT>,
}) => {
    const zoomLevels = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0];
    return (
        <div
            style={{
                position: 'absolute',
                zIndex: 10000,
                boxShadow: '0 0 2px #666',
                backgroundColor: 'white',
                padding: 4,
                bottom: 10,
                left: 10,
            }}
            onClick={evt => evt.stopPropagation()}
            onMouseDown={evt => evt.stopPropagation()}
        >
            <button onClick={() => setFlashcard(true)}>Flashcard Mode</button>
            <AddCard
                onAdd={(title, description, header) => {
                    const id = client.getStamp();
                    const card: CardT = {
                        id,
                        title,
                        description,
                        header,
                        scales: {},
                        tags: {},
                        position: {
                            x: state.pan.x + DEFAULT_MARGIN * 4,
                            y: state.pan.y + DEFAULT_MARGIN * 4,
                        },
                        size: {
                            y: DEFAULT_HEIGHT,
                            x: DEFAULT_WIDTH * (header != null ? 2 : 1),
                        },
                        disabled: false,
                    };
                    col.save(id, card);
                }}
            />
        </div>
    );
};

export default Hud;
