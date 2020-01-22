// @flow
// import {create, createMap, merge}
require('@babel/register')({ presets: ['@babel/preset-flow'] });

const { permute } = require('../test-utils/permute');

/* So, re-living map set scenarios:
Clients A and B

- we have a node with a {types: {code: {language: 'javascript'}}}
- A deletes types:code
- A recreates types:code w/ language 'java'
- B sets language to 'perl'
- they sync

>> in this case, you could argue that the language should be 'java', not 'perl'
>> but I'm pretty sure we don't have a way to make that happen.

- we have a node with a {types: {code: {language: 'javascript'}}}
- A deletes types:code
- A syncs to C & B
- C recreates types:code w/ language 'java'
- C syncs to B
- B sets language to 'perl'
- B's last message syncs to A, before the recreate message.

>> in this case, the language should definitely be 'perl'

*/

/*::
import type {Delta} from '../plain-always-wins';
*/

const {
    value,
    createDeepMap,
    set,
    remove,
    create,
    merge,
    removeAt,
    show,
    // deltas,
    // applyDelta,
    // showDelta,
} =
    // require('./no-schema-change');
    // require('./plain-always-wins');
    require('../pruned-merge');

let id = 0;
const tick = () => {
    return (id++).toString().padStart(1, '0');
};

// first
const orig = createDeepMap(
    { text: 'var x = 5', types: { code: { language: 'javascript' } } },
    tick(),
);

// const allDeltas = [
//     deltas.removeAt(['types'], tick()),
//     deltas.set(['types', 'code'], create(5, tick())),
//     deltas.set(
//         ['types'],
//         createDeepMap({ code: { language: 'java' } }, tick()),
//     ),
//     deltas.set(['types', 'code', 'language'], create('perl', tick())),
// ];

const all = [orig];
const removed = removeAt(orig, ['types'], tick());
all.push(removed);
// all.push(set(orig, ['types', 'plain'], create(true, tick())));
all.push(set(orig, ['types', 'code'], create(5, tick())));
all.push(
    set(
        removed,
        ['types'],
        createDeepMap({ code: { language: 'java' } }, tick()),
        // tick(),
    ),
);
all.push(set(orig, ['types', 'code', 'language'], create('perl', tick())));

const chalk = require('chalk');

const evaluate = permutation => {
    let result = permutation[0];
    console.log(` (${0}):`, show(result));
    // console.log(`     -->`, value(result));
    for (let i = 1; i < permutation.length; i++) {
        result = merge(result, permutation[i]);
        console.log(` (${i}):`, show(permutation[i]));
        console.log(`  -->`, chalk.green(show(result)));
    }
    return result;
};

// const evaluateDeltas = (original, permutation) => {
//     let result = original;
//     console.log(` (${0}):`, show(result));
//     // console.log(`     -->`, value(result));
//     for (let i = 0; i < permutation.length; i++) {
//         result = applyDelta(result, permutation[i]);
//         console.log(` (${i}):`, showDelta(permutation[i]));
//         console.log(`  -->`, chalk.green(show(result)));
//     }
//     return result;
// };

const results = {};

permute(all).forEach((permutation, i) => {
    console.log(i);
    const res = evaluate(permutation);
    const raw = JSON.stringify(value(res));
    if (!results[raw]) {
        results[raw] = [];
    }
    results[raw].push([i, permutation]);
    console.log('-->', JSON.stringify(value(res)));
});

// permute(allDeltas).forEach((permutation, i) => {
//     console.log(i);
//     const res = evaluateDeltas(orig, permutation);
//     const raw = JSON.stringify(value(res));
//     if (!results[raw]) {
//         results[raw] = [];
//     }
//     results[raw].push([i, permutation]);
//     console.log('-->', JSON.stringify(value(res)));
// });

console.log('ok');
console.log(
    'Results',
    Object.keys(results)
        .map(k => `${results[k].length} : ${k}`)
        .join('\n'),
);
