// we're looking for
// commutativity
// associativity

// maybe generate all the permutations, and then dedup on prefix?

const check = (initial, ops, apply, eq) => {
    const cache = {};
    const seen = {};
    // maybe dynamic programming is all we need.
    const all = permute(ops.map((v, i) => [v, i]));
    for (let order of all) {
        let current = initial;
        let is = [];
        for (let [op, i] of order) {
            is.push(i);
            const ukey = is.join(':');
            if (seen[ukey]) {
                current = seen[ukey];
                continue;
            }
            const key = is
                .slice()
                .sort()
                .join(':');
            current = apply(current, op);
            seen[ukey] = current;
            if (!cache[key]) {
                cache[key] = [{ is: [is.slice()], current }];
            } else {
                let found = false;
                for (let entry of cache[key]) {
                    if (eq(entry.current, current)) {
                        entry.is.push(is.slice());
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    cache[key].push({ is: [is.slice()], current });
                }
            }
        }
    }
    const failures = [];
    for (let key in cache) {
        if (cache[key].length > 1) {
            failures.push({ key, conflicts: cache[key] });
        }
    }
    return failures;
};

function permute(rest, prefix = []) {
    if (rest.length === 0) {
        return [prefix];
    }
    return [].concat(
        ...rest.map((x, index) => {
            const oldRest = rest;
            const oldPrefix = prefix;
            const newRest = rest.slice(0, index).concat(rest.slice(index + 1));
            const newPrefix = prefix.concat([x]);

            const result = permute(newRest, newPrefix);
            return result;
        }),
    );
}

module.exports = { check, permute };
