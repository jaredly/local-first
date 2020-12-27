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
// const { findImageFromPage } = require('./import-from-foood');
// findImageFromPage(
//     'https://www.pbs.org/food/kitchenexplorers/2014/05/08/7-minute-lemon-curd-recipe',
// ).then(
//     (res) => {
//         console.log('found', res);
//     },
//     (err) => {
//         console.log('nope');
//         console.error(err);
//     },
// );
require('./index.js');
