// @flow
import {
    deltas,
    create,
    createDeepMap,
    value,
    applyDelta,
    showDelta,
    merge,
    show,
} from '../index.js';

import { generateDeltas } from '../test-utils/generate-deltas';
import { check } from '../test-utils/permute';

const testPermutations = (base, deltas) => {
    return check(
        base,
        deltas,
        applyDelta,
        (a, b) => JSON.stringify(value(a)) === JSON.stringify(value(b)),
    );
};

const testMerges = (base, deltas) => {
    return check(
        base,
        deltas.map(delta => applyDelta(base, delta)),
        merge,
        (a, b) => JSON.stringify(value(a)) === JSON.stringify(value(b)),
    );
};

const exampleData = {
    name: 'Top level',
    nested: {
        level: 1,
        inner: {
            at: 'level 2',
        },
    },
};

const showFailures = (crdt, failures, ops) => {
    failures.forEach(({ key, conflicts }) => {
        console.log(
            `Conflict: with set '${key}', ${conflicts.length} competing results`,
        );
        console.log(show(crdt));
        conflicts.forEach(result => {
            console.log(result.is.map(k => k.join(':')).join(' & '));
            let v = crdt;
            result.is[0].forEach(i => {
                console.log('  ', showDelta(ops[i]));
                v = applyDelta(v, ops[i]);
                console.log('  ->', show(v));
            });
            // console.log(
            //     '  ' +
            //         result.is[0]
            //             .map(i => ops[i])
            //             .map(showDelta)
            //             .join('\n  '),
            // );
            console.log('  ->', JSON.stringify(value(result.current)));
        });
        console.log();
    });
};

if (process.argv.length === 3 && process.argv[2] === '--retest') {
    const { failures, crdt, ops } = JSON.parse(
        require('fs').readFileSync('./failures.json', 'utf8'),
    );
    showFailures(crdt, failures, ops);
    process.exit(1);
}

const allDeltas = generateDeltas(create, createDeepMap, deltas, exampleData);
const crdt = createDeepMap(exampleData, '0');
allDeltas.forEach(({ path, deltas }) => {
    console.log(path.path);
    deltas.forEach(ops => {
        let failures = testPermutations(crdt, ops);
        if (failures.length) {
            showFailures(crdt, failures, ops);
            require('fs').writeFileSync(
                './failures.json',
                JSON.stringify(
                    {
                        crdt,
                        failures,
                        ops,
                    },
                    null,
                    2,
                ),
                'utf8',
            );
            process.exit(1);
        }

        failures = testMerges(crdt, ops);
        if (failures.length) {
            failures.forEach(({ key, conflicts }) => {
                console.log('Conflict:', key);
                conflicts.forEach(result => {
                    console.log(result.is.map(k => k.join(':')).join(' & '));
                    console.log(
                        result.is[0]
                            .map(i => ops[i])
                            .map(op => show(applyDelta(crdt, op)))
                            .join('\n'),
                    );
                    console.log(JSON.stringify(value(result.current)));
                });
                console.log();
            });
            process.exit(1);
        }

        process.stdout.write('.');
    });
});
