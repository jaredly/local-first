console.log('hi');

import { createManualNetwork } from '../../../packages/core/src/delta/polling-network';
// import createDeltaClient from '../../../packages/core/delta/create-client'
import {
    clientCrdtImpl,
    createDeltaClient,
    createPollingNetwork,
    inMemoryClockPersist,
    PersistentClock,
    makeDeltaInMemoryPersistence,
} from '../../../packages/client-bundle';

const schemas = require('../collections');

const url = 'http://localhost:9090/dbs/sync?db=foood';

const client = createDeltaClient(
    'in-memory',
    clientCrdtImpl,
    schemas,
    new PersistentClock(inMemoryClockPersist()),
    makeDeltaInMemoryPersistence(Object.keys(schemas)),
    createManualClient(url),
);

console.log('hi');
// do I need a websocket module? Maybe just a node-fetch

// const { runMulti2, run } = require('../../packages/server-bundle/full.js');
// const { validateDelta } = require('../../packages/nested-object-crdt/src/schema.js');
// require('regenerator-runtime');
// const fs = require('fs');
// const dataPath = __dirname + '/.data/store';
// const port = process.env.PORT != null ? parseInt(process.env.PORT) : 9090;

// const treeNotesSchemas = require('../tree-notes/collections.js');
// const fooodSchemas = require('../foood/collections.js');
// const result = runMulti2(dataPath, { trees: treeNotesSchemas, foood: fooodSchemas }, port);

// console.log('listening on ' + port);
// result.app.get('/', (req, res) => {
//     res.send('ok');
//     res.end();
// });
// if (process.env.BACKUP_SECRET) {
//     const backupRoute = require('../../packages/server-backup');
//     result.app.get(
//         '/backup/' + process.env.BACKUP_SECRET,
//         backupRoute('.data/store', process.env.FIREBASE_APP),
//     );
// }
// if (process.env.BACKUP_DOWNLOAD) {
//     result.app.get('/backup/' + process.env.BACKUP_DOWNLOAD, downloadRoute('.data/store'));
// }
