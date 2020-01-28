// @flow
import { type Schema } from '@local-first/nested-object-crdt/lib/schema.js';

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
