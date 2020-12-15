#!/usr/bin/env node
// Ok folks
// const fs = require('fs');
const pack = require('./packages/monorepo-pack');

const packages = [
    // apps
    {
        name: 'planner',
        entry: 'examples/planner/server/glitch.js',
        dest: 'public/planner-server',
        start: true,
    },
    {
        name: 'general-server',
        entry: 'examples/general-server/glitch.js',
        dest: 'public/general-server',
        start: true,
    },
    {
        name: 'things-to-share',
        entry: 'examples/things-to-share/server/glitch.js',
        dest: 'public/things-to-share-server',
        start: true,
    },
    {
        name: 'whiteboard',
        entry: 'examples/whiteboard/server/glitch.js',
        dest: 'public/whiteboard-server',
        start: true,
    },
    // libs
    {
        name: 'server-backup',
        entry: 'packages/server-backup/index.js',
        dest: 'public/server-backup',
    },
    {
        name: 'server-bundle',
        entry: 'packages/server-bundle/full.js',
        dest: 'public/server-bundle',
    },
    {
        name: 'client-bundle',
        entry: 'packages/client-bundle/index.js',
        dest: 'public/client-bundle',
    },
    {
        name: 'rich-text-crdt',
        entry: 'packages/rich-text-crdt/index.js',
        dest: 'public/rich-text-crdt',
    },
    {
        name: 'nested-object-crdt',
        entry: 'packages/nested-object-crdt/src/new.js',
        dest: 'public/nested-object-crdt',
    },
];

const [_, __, arg] = process.argv;

if (arg) {
    if (
        !packages.some(package => {
            if (package.name === arg) {
                pack(package);
                return true;
            }
        })
    ) {
        console.error(`No package named ${arg}`);
    }
} else {
    packages.forEach(pack);
}

// pack({
//     name: 'hybrid-logical-clock',
//     entry: 'packages/hybrid-logical-clock/src/index.js',
//     dest: 'public/hybrid-logical-clock',
// });

// pack({
//     name: 'local-first-bundle',
//     entry: 'packages/local-first-bundle/src/index.js',
//     dest: 'public/local-first-bundle',
// });
