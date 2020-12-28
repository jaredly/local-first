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

// const image = 'https://www.javirecipes.com/arroz-con-leche/';
// const image =
//     'https://getpocket.com/explore/item/we-tried-8-methods-of-cooking-bacon-and-found-an-absolute-winner';
// const image =
//     // ok
//     'https://www.thespicehouse.com/blogs/recipes/lamb-korma-recipe';
// // 'https://www.youtube.com/watch?v=dj8tuQ1RojM';
// // 'https://petitworldcitizen.com/2015/02/08/hazelnut-buckwheat-granola-bars/';
// // 'https://www.joyofbaking.com/BruttimaBuoni.html';
// // 'https://figjamandlimecordial.com/2010/09/18/braided-loaves/';
// // 'https://www.thespruceeats.com/bok-choy-chicken-soup-694299';
// // 'http://www.ecurry.com/blog/condiments-dips-and-sauces/beetroot-raita-lightly-seasoned-beetroot-and-yogurt-salad/';
// const { findImageFromPage } = require('./import-from-foood');
// findImageFromPage(image).then(
//     (res) => {
//         console.log('found', res);
//     },
//     (err) => {
//         console.log('nope');
//         console.error(err);
//     },
// );
