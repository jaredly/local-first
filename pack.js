// Ok folks
// const fs = require('fs');
const pack = require('./packages/monorepo-pack');

// const packages = {
//     // 'hybrid-logical-clock': true,
//     // ummm
//     'local-first-bundle': {
//         external: [],
//     },
// };

// pack({
//     name: 'example',
//     entry: 'examples/simple-example/server/index.js',
//     dest: 'public/example-server',
// });

pack({
    name: 'example',
    entry: 'examples/whiteboard/server/glitch.js',
    dest: 'public/whiteboard-server',
    start: true,
});

fail;

pack({
    name: 'example',
    entry: 'packages/server-bundle/index.js',
    dest: 'public/server-bundle',
});

pack({
    name: 'example',
    entry: 'packages/client-bundle/index.js',
    dest: 'public/client-bundle',
});

pack({
    name: 'rich-text-crdt',
    entry: 'packages/rich-text-crdt/index.js',
    dest: 'public/rich-text-crdt',
});

pack({
    name: 'nested-object-crdt',
    entry: 'packages/nested-object-crdt/src/new.js',
    dest: 'public/nested-object-crdt',
});

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
