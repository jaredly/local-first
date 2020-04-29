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

// How do we handle pauses?
// hmm. We could do "pauseTime" and ""
// Buut how does this mesh with...
// ok, so we could just have an object that is "pauses"
// and the key is the startTime, and the value is the endTime.
export type TimeT = {
    id: string, // will be "item:itemid-notherstamp" or "habit:habitid-notherstamp" I think?
    // so you parse out the ID to get the thing this is referring to. And you can
    // query like "id range" "item:itemid_" to "item:itemid_+" or something
    start: number, // timestamp yup
    end: ?number, // can query on null for "currently running"
    notes: ?string, // can be like "goals for this session" or something probably
    // maybe have a flag indicating whether this was the one that "completed" it?
    // can infer that probably, or also add it in later :shrug:
    pauses: { [startTime: string]: number },
};

export const TimeSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        start: 'number',
        end: { type: 'optional', value: 'number' },
        notes: { type: 'optional', value: 'string' },
        pauese: { type: 'map', value: 'number' },
    },
};

export const newItemTime = (itemId: string, stamp: string) => ({
    id: `item:${itemId}-${stamp}`,
    start: Date.now(),
    end: null,
    notes: null,
    pauses: {},
});

export const newHabitTime = (habitId: string, stamp: string) => ({
    id: `habit:${habitId}-${stamp}`,
    start: Date.now(),
    end: null,
    notes: null,
    pauses: {},
});

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
    horizon?: ?number, // 0 for immediate, 1 for near, 2 for far
    dueDate?: ?number,
    timeEstimate?: ?number,
    tags: { [tagId: string]: number },
    emojis: { [emoji: string]: number },
    comments: ?{ [key: string]: { text: string, date: number } },
    timeTracked?: number, // the most recent time that a tracker was started
    // if the time is fairly recent, we can do a lookup for all the trackers
    // for this node, to display accurate time info.
    // If it's old, we can just show an icon or something, which you can click
    // to get that info fetched.

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
        horizon: { type: 'optional', value: 'number' },
        timeTracked: { type: 'optional', value: 'number' },
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
    goalFrequency: ?number, // in X per Week. 0 means no goal. 0.5 is every other week or so? maybe
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
        goalFrequency: { type: 'optional', value: 'number' },
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
            duration: number,
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
                    duration: 'number',
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
