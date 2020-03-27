// @flow
import * as crdt from '../../../packages/nested-object-crdt/src/new';
import type { Schema } from '../../../packages/nested-object-crdt/src/schema.js';
import type {
    Delta as NewDelta,
    CRDT,
} from '../../../packages/nested-object-crdt/src/types.js';
import make from '../../../packages/core/src/server';

import setupPersistence from '../../../packages/server-bundle/sqlite-persistence';
// import setupPersistence from '../../../packages/core/src/memory-persistence';

import { runServer } from '../../../packages/server-bundle';

type Delta = NewDelta<any, null, any>;
type Data = CRDT<any, null>;

const crdtImpl = {
    createEmpty: crdt.createEmpty,
    applyDelta: crdt.applyDelta,
    deltas: {
        stamp: delta => crdt.deltas.stamp(delta, () => null),
    },
};

export const run = (dataPath: string, port: number = 9090) => {
    const server = make<Delta, Data>(crdtImpl, setupPersistence(dataPath));
    return runServer(port, dataPath, server);
};
