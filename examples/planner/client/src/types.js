// @flow

import { type Schema } from '../../../../packages/client-bundle';
import { type Sort } from '../../../../packages/nested-object-crdt/src/types';

export type TagT = {
    id: string,
    title: string,
    color: string,
};

export const TagSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        color: 'string',
    },
};

export type ItemT = {
    id: string,
    title: string,
    style?: ?string, // could be 'group', or something else I guess
    description: string,
    createdDate: number,
    completedDate?: ?number,
    trashedDate?: ?number,
    deferUntil?: ?number,
    checkDates: { [date: string]: boolean },
    dueDate?: ?number,
    timeEstimate?: ?number,
    tags: { [tagId: string]: number },
    emojis: { [emoji: string]: number },
    comments: ?{ [key: string]: { text: 'string', created: number } },

    // parent: ?{ id: string, idx: Sort },
    children: Array<string>,
};

export const newItem = (id: string, title: string) => ({
    id,
    title,
    description: '',
    createdDate: Date.now(),
    checkDates: {},
    tags: {},
    emojis: {},
    children: [],
    comments: {},
});

export const ItemSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        style: { type: 'optional', value: 'string' },
        description: 'string',
        createdDate: 'number',
        trashedDate: { type: 'optional', value: 'number' },
        deferUntil: { type: 'optional', value: 'number' },
        completedDate: { type: 'optional', value: 'number' },
        checkDates: { type: 'map', value: 'boolean' },
        dueDate: { type: 'optional', value: 'number' },
        timeEstimate: { type: 'optional', value: 'number' },
        tags: { type: 'map', value: 'number' },
        emojis: { type: 'map', value: 'number' },
        comments: {
            type: 'optional',
            value: {
                type: 'map',
                value: {
                    type: 'object',
                    attributes: {
                        text: 'string',
                        date: 'number',
                    },
                },
            },
        },
        // parent: {
        //     type: 'optional',
        //     value: { type: 'object', attributes: { id: 'string', idx: 'array' } },
        // },
        children: 'id-array',
    },
};

// -> <-> These are also for "recurring" generally, like chores and stuff.
export type HabitT = {
    id: string,
    title: string,
    description: string,
    createdDate: number,
    archived: ?number,
    // um so do we want a "goal" here?
    // or just a "frequency"?
    // don't need to be too fancy here.
    goalFrequency: number, // in X per Week. 0 means no goal. 0.5 is every other week or so? maybe
    // how do we know how we're doing? We load up the last 7 days I guess
};

export const newHabit = (
    id: string,
    title: string,
    description: string,
    goalFrequency: ?number,
) => ({
    id,
    title,
    description,
    createdDate: Date.now(),
    archived: null,
    goalFrequency,
});

export const HabitSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        description: 'string',
        createdDate: 'number',
        archived: { type: 'optional', value: 'number' },
        goalFrequency: 'number',
    },
};

export const newDay = (id: string) => ({
    id,
    // date: number, // like date but w/o the hours, minutes, miliseconds? hmm no. "days since X" might be it.
    notes: '',
    dailyInTermsOfWeekly: '',
    habits: {},
    schedule: {},
    toDoList: {
        topTwo: {
            one: null,
            two: null,
        },
        others: [],
    },
});

export type Day = {
    id: string,
    // date: number, // like date but w/o the hours, minutes, miliseconds? hmm no. "days since X" might be it.
    notes: string,
    dailyInTermsOfWeekly: string,
    habits: {
        [habitid: string]: {
            notes: ?string,
            completed: ?number,
        },
    },
    schedule: {
        [key: string]: {
            id: string,
            itemId: ?string,
            startTime: number,
            endTime: number,
            notes: ?string,
            completed: ?number,
            // TODO maybe keep track of modification history? idk
        },
    },
    toDoList: {
        topTwo: {
            one: ?string,
            two: ?string,
        },
        others: Array<string>,
    },
};

export const DaySchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        // date: 'number',
        notes: 'string',
        dailyInTermsOfWeekly: 'string',
        habits: {
            type: 'map',
            value: {
                type: 'object',
                attributes: {
                    notes: { type: 'optional', value: 'string' },
                    completed: { type: 'optional', value: 'number' },
                },
            },
        },
        schedule: {
            type: 'map',
            value: {
                type: 'object',
                attributes: {
                    id: 'string',
                    itemId: { type: 'optional', value: 'string' },
                    startTime: 'number',
                    endTime: 'number',
                    notes: { type: 'optional', value: 'string' },
                    completed: { type: 'optional', value: 'number' },
                },
            },
        },
        toDoList: {
            type: 'object',
            attributes: {
                topTwo: {
                    type: 'object',
                    attributes: {
                        one: { type: 'optional', value: 'string' },
                        two: { type: 'optional', value: 'string' },
                    },
                },
                others: 'id-array',
            },
        },
    },
};

const colorsRaw = '1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf';
export const colors = [];
for (let i = 0; i < colorsRaw.length; i += 6) {
    colors.push('#' + colorsRaw.slice(i, i + 6));
}
