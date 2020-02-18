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

module.exports = { ItemSchema };
