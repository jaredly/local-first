#!/usr/bin/env node
// @flow
require('@babel/register')({
    ignore: [/node_modules/],
    presets: ['@babel/preset-flow', '@babel/preset-env'],
    plugins: ['@babel/plugin-proposal-class-properties']
});

const { serverForUser } = require('../../../packages/server-bundle/full.js');
const fs = require('fs');
const path = require('path');

const cliSession = `_cli_${Date.now()}`;

const { LinkSchema } = require('../client/src/types');
const hlc = require('../../../packages/hybrid-logical-clock');

const commands = {
    import: ([userId, collection, fileName]) => {
        if (!userId || !collection || !fileName) {
            console.error(`Usage: import userId collectionName fileName`);
            process.exit(1);
        }

        const session = `_cli_${Date.now()}`;
        let clock = hlc.init(session, Date.now());
        const getStamp = () => {
            clock = hlc.inc(clock, Date.now());
        };

        const server = serverForUser(path.join(__dirname, '.data'), userId);
        const data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
        server.persistence.addDeltas(
            collection,
            cliSession,
            data.map(data => ({
                node: data.id,
                delta: {
                    type: 'set',
                    path: [],
                    value: server.crdt.createWithSchema(data, getStamp(), getStamp, LinkSchema)
                }
            }))
        );
    }
};

const [_, __, cmd, ...opts] = process.argv;
if (!commands[cmd]) {
    console.warn(`Usage: cli.js [cmd]`);
    Object.keys(commands).forEach(cmd => {
        console.log(`- ${cmd}`);
    });
    process.exit(1);
}
commands[cmd](opts);
