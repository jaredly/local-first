#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: ['node_modules'],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
});
const { runServer, makeServer } = require('./index.js');
const dataPath = __dirname + '/.data';
runServer(9900, dataPath, makeServer(dataPath));
console.log('listening on 9900');
