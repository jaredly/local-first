// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { render } from 'react-dom';
import React from 'react';
import { createInMemoryDeltaClient } from '../../../packages/client-bundle';

type Card = {
    title: string,
    description: string,
    position: { x: number, y: number },
    size: { width: number, height: number },
    color: string,
    header: ?number,
    disabled: boolean,
};

const setupDelta = () => {
    return createDeltaClient(
        newCrdt,
        schemas,
        new PersistentClock(localStorageClockPersist('local-first')),
        makeDeltaPersistence('local-first', ['tasks', 'notes']),
        createWebSocketNetwork('ws://localhost:9900/sync'),
    );
};
