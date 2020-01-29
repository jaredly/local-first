#!/usr/bin/env node
// @flow
require('@babel/register');
const { runServer, makeServer } = require('./index.js');
runServer(9900, makeServer(__dirname + '/.data'));
console.log('listening on 9900');
