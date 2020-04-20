#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties'],
});
const { run } = require('../../../packages/server-bundle/full.js');
const { addProxy } = require('./');
const dataPath = __dirname + '/.data';
const port = process.env.PORT != null ? parseInt(process.env.PORT) : 9090;
const { getSchemaChecker } = require('./getSchema');
const result = run(dataPath, getSchemaChecker, port);
addProxy(result.app);
console.log('listening on ' + port);
