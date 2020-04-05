// @flow

import { type pos, type rect, type CardT, colors } from './types';

export const DEFAULT_MARGIN = 12;
export const DEFAULT_HEIGHT = 100;
export const DEFAULT_WIDTH = 200;

const defaultCards = require('./data.json');

const shuffle = (array) => {
    return array
        .map((item) => [Math.random(), item])
        .sort((a, b) => a[0] - b[0])
        .map((item) => item[1]);
};

export const makeDefaultCards = (genId: () => string): Array<CardT> => {
    return shuffle(defaultCards).map(({ description, title }, i): CardT => ({
        id: genId(),
        title,
        description,
        disabled: false,
    }));
};
