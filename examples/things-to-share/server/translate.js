#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties']
});

const hlc = require('../../../packages/hybrid-logical-clock');
const fs = require('fs');

const data = require('./parsed.json');

let clock = hlc.init(`_cli_${Date.now()}`, Date.now());
const getStamp = () => {
    clock = hlc.inc(clock, Date.now());
    return hlc.pack(clock);
};

fs.writeFileSync(
    'importable.json',
    JSON.stringify(
        data.map(({ fetchedContent, url, description, completed, added }) => ({
            id: getStamp(),
            url,
            fetchedContent,
            tags: {},
            description: description ? [{ insert: description }] : null,
            completed,
            added
        })),
        null,
        2
    )
);
