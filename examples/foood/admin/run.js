#!/usr/bin/env node
// @flow
require('../node_modules/regenerator-runtime');
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties'],
});

// $FlowFixMe it's fine
const fetch = require('../../planner/server/node_modules/node-fetch');
global.fetch = fetch;
require('./index.js');
