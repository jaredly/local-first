// @flow

const ItemSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        author: 'string',
        body: 'rich-text',
        tags: { type: 'map', value: 'number' },
        createdDate: 'number',
        completed: { type: 'optional', value: 'number' },

        columnData: { type: 'map', value: 'rich-text' },
        childColumnConfig: {
            type: 'optional',
            value: {
                type: 'object',
                attributes: {
                    recursive: 'boolean',
                    columns: {
                        type: 'map',
                        value: {
                            type: 'object',
                            attributes: {
                                title: 'string',
                                kind: 'string',
                                width: { type: 'optional', value: 'number' },
                            },
                        },
                    },
                },
            },
        },

        // hmk right?

        style: 'string', // header | code | quote | todo
        theme: 'string', // list | blog | whiteboard | mindmap
        numbering: {
            type: 'optional',
            value: {
                type: 'object',
                attributes: {
                    style: 'string',
                    startWith: { type: 'optional', value: 'number' },
                },
            },
        }, // {style: numbers | letters | roman, startWith?: number}

        trashed: { type: 'optional', value: 'number' },
        // {[reaction-name]: {[userid]: date}}
        reactions: { type: 'map', value: { type: 'map', value: 'number' } },
    },
};

/*::
import type {CRDT} from '../../packages/rich-text-crdt'
export type ItemT = {
    id: string,
    author: string,
    body: CRDT,
    tags: {[key: string]: number},
    createdDate: number,
    completed?: number,

    columnData: {[colId: string]: CRDT},
    childColumnConfig: ?{
        columns: {[colId: string]: {
            title: string,
            kind: string,
            width?: number,
        }},
        recursive: boolean,
    },

    style: string,
    theme: string,
    numbering: ?{
        style: string,
        startWith?: number,
    },

    trashed?: number,
    reactions: {[reactionId: string]: {[userId: string]: number}}
}
*/

const schemas = {
    items: ItemSchema,
};

module.exports = schemas;
