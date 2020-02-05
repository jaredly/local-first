#!/usr/bin/env node
// @flow
require('@babel/register');
const { runServer, makeServer } = require('./index.js');
const dataPath = __dirname + '/.data';
runServer(9900, dataPath, makeServer(dataPath));
console.log('listening on 9900');
