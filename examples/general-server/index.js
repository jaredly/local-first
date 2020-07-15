#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties'],
});
const { runMulti2, run } = require('../../packages/server-bundle/full.js');
const { validateDelta } = require('../../packages/nested-object-crdt/src/schema.js');
require('regenerator-runtime');
const fs = require('fs');
const dataPath = __dirname + '/.data/store';
const port = process.env.PORT != null ? parseInt(process.env.PORT) : 9090;

const treeNotesSchemas = require('./treeNotesSchemas');
const result = runMulti2(dataPath, { trees: treeNotesSchemas }, port);

const getSchemaChecker = colid =>
    treeNotesSchemas[colid] ? delta => validateDelta(treeNotesSchemas[colid], delta) : null;

// const result = run(dataPath, getSchemaChecker, port);

console.log('listening on ' + port);
result.app.get('/', (req, res) => {
    res.send('ok');
    res.end();
});
if (process.env.BACKUP_SECRET) {
    const backupRoute = require('@local-first/server-backup');
    result.app.get(
        '/backup/' + process.env.BACKUP_SECRET,
        backupRoute('.data/store', process.env.FIREBASE_APP),
    );
}
