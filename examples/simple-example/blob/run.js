#!/usr/bin/env node
const server = require('./server');
server(__dirname + '/.data', 7898);
