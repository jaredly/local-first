// @flow

/**

Schemas:



*/

const Settings = {
    type: 'object',
    attributes: {
        // This is a list of ids of tags that are to be treated as "categories".
        // e.g. they are shown at the top of the home page.
        categories: 'id-array',
    },
};

const TagSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        text: 'string',
        color: { type: 'optional', value: 'string' },
        created: 'int',
    },
};

const CommentSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        author: 'string',
        text: 'object', // this'll be a quill delta, but we don't need real-time or intelligent merging here
        date: 'int',
        happiness: 'int',
        images: 'id-array',
        // TODO more metadata about the experience? idk
    },
};

const RecipeSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        author: 'string',
        source: 'string',
        // this has ingredients + instructions
        // also metadata like ovenTemp, bakeTime, yield
        // also maybe "notes"?
        contents: 'object', // opaque, because we do internal manual versioning.
        status: 'string', // 'evaluating' | 'approved' | 'rejected'
        createdDate: 'int',
        updatedDate: 'int',
        trashedDate: { type: 'optional', value: 'int' },
        comments: {
            type: 'map',
            value: CommentSchema,
        },
    },
};

const ItemSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        author: 'string',
        body: 'rich-text',
        tags: { type: 'map', value: 'number' },
        createdDate: 'number',
        completed: { type: 'optional', value: 'number' },

        children: 'id-array',

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
    children: Array<string>,

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
