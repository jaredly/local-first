// @flow

import { type pos, type rect, type CardT, type ScaleT, type TagT, colors } from './types';

export const DEFAULT_MARGIN = 12;
export const DEFAULT_HEIGHT = 100;
export const DEFAULT_WIDTH = 200;

const defaultCards = require('./data.json');

export const makeDefaultScales = (genId: () => string): Array<ScaleT> => {
    const titles = `
How much I value
How much I want to value
How much I have
How much I think about
Want to change focus
`
        .trim()
        .split('\n')
        .map(title => title.trim());
    return titles.map((title, i) => ({
        id: genId(),
        title,
        color: colors[i],
        min: 1,
        max: 5,
        createdDate: Date.now(),
    }));
};

export const makeDefaultTags = (genId: () => string): Array<TagT> => {
    const titles = `
growth area
family
work
conflicted
`
        .trim()
        .split('\n')
        .map(t => t.trim());
    return titles.map((title, i) => ({
        id: genId(),
        title,
        color: colors[i],
        style: 'background',
        createdDate: Date.now(),
    }));
};

export const makeDefaultHeadings = (genId: () => string): Array<CardT> => {
    const titles = `
Most Important to Me
Very Important To Me
Important To Me
Somewhat Important to Me
Not Important to Me
`
        .trim()
        .split('\n')
        .map(title => title.trim());
    return titles.map((title, i) => ({
        id: genId(),
        title,
        description: '',
        tags: {},
        scales: {},
        position: {
            x: DEFAULT_MARGIN + i * (DEFAULT_WIDTH * 2.0 + DEFAULT_MARGIN),
            y: DEFAULT_MARGIN + 50,
        },
        size: { y: DEFAULT_HEIGHT, x: DEFAULT_WIDTH * 2.0 },
        header: 1,
        disabled: false,
    }));
};

const shuffle = array => {
    return array
        .map(item => [Math.random(), item])
        .sort((a, b) => a[0] - b[0])
        .map(item => item[1]);
};

export const makeDefaultCards = (genId: () => string): Array<CardT> => {
    return shuffle(defaultCards).map(({ description, title }, i): CardT => ({
        id: genId(),
        title,
        description,
        tags: {},
        scales: {},
        position: {
            x: DEFAULT_MARGIN + parseInt(i / 10) * (DEFAULT_WIDTH + DEFAULT_MARGIN),
            y: DEFAULT_MARGIN + 500 + (i % 10) * (DEFAULT_HEIGHT + DEFAULT_MARGIN),
        },
        size: { y: DEFAULT_HEIGHT, x: DEFAULT_WIDTH },
        disabled: false,
    }));
};
