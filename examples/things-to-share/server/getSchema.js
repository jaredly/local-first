// @flow

import { TagSchema, LinkSchema } from '../client/src/types';

export const getSchema = colid =>
    ({
        tags: TagSchema,
        links: LinkSchema,
    }[colid]);
