// @flow

import { type Schema } from '../../../packages/client-bundle';

export type TagT = {
    id: string,
    title: string,
    color: string
};

export const TagSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        color: 'string'
    }
};

export type LinkT = {
    id: string,
    url: string,
    fetchedContent: mixed,
    tags: { [key: string]: boolean },
    description: mixed,
    completed: ?string
};

export const LinkSchema: Schema = {
    type: 'object',
    id: 'string',
    url: 'string',
    fetchContent: 'any',
    tags: { type: 'map', value: 'boolean' },
    description: 'any',
    completed: { type: 'optional', value: 'string' }
};

// export type Comment
// export type Reaction = {
//     id: string,
// }

const colorsRaw = '1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf';
export const colors = [];
for (let i = 0; i < colorsRaw.length; i += 6) {
    colors.push('#' + colorsRaw.slice(i, i + 6));
}
