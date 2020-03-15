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

pack({
    name: 'hybrid-logical-clock',
    entry: 'packages/hybrid-logical-clock/src/index.js',
    dest: 'public/hybrid-logical-clock',
});

// pack({
//     name: 'local-first-bundle',
//     entry: 'packages/local-first-bundle/src/index.js',
//     dest: 'public/local-first-bundle',
// });
