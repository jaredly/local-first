// @flow

import { TagSchema, LinkSchema } from '../shared/types';
import { validateDelta } from '../../../packages/nested-object-crdt/src/schema';

export const getSchemaChecker = (colid: string) =>
    ({
        tags: delta => validateDelta(TagSchema, delta),
        links: delta => validateDelta(LinkSchema, delta),
    }[colid]);
