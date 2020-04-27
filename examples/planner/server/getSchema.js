// @flow

import { ItemSchema, TagSchema, HabitSchema, DaySchema, TimeSchema } from '../client/src/types';
import { validateDelta } from '../../../packages/nested-object-crdt/src/schema';

const schemas = {
    items: ItemSchema,
    tags: TagSchema,
    habits: HabitSchema,
    days: DaySchema,
    times: TimeSchema,
};

export const getSchemaChecker = (colid: string) =>
    schemas[colid] ? delta => validateDelta(schemas[colid], delta) : null;
