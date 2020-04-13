#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties']
});
const { run } = require('../../../packages/server-bundle/full.js');
const dataPath = __dirname + '/.data';
const port = process.env.PORT || 9090;
run(dataPath, port);
console.log('listening on ' + port);
