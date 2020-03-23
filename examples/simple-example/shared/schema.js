// @flow
import { type Schema } from '../../../packages/nested-object-crdt/src/schema.js';

const ItemSchema: Schema = {
    type: 'object',
    attributes: {
        completed: 'boolean',
        title: 'string',
        createdDate: 'int',
        tags: { type: 'map', value: 'boolean' },
    },
};

const NoteSchema: Schema = {
    type: 'object',
    attributes: {
        title: 'string',
        body: 'rich-text',
        createDate: 'int',
    },
};

module.exports = { ItemSchema, NoteSchema };
