// @flow

const makeTick = () => {
    let id = 1;
    return () => {
        return (id++).toString().padStart(1, '0');
    };
};

const allKeyPaths = (
    data /*:any*/,
) /*:Array<{path: Array<string>, value: any}>*/ => {
    return [].concat(
        ...Object.keys(data).map(k => {
            if (data[k] && typeof data[k] === 'object') {
                return [{ path: [k], value: data[k] }].concat(
                    allKeyPaths(data[k]).map(({ path, value }) => ({
                        path: [k].concat(path),
                        value,
                    })),
                );
            }
            return [{ path: [k], value: data[k] }];
        }),
    );
};

const randomValue = (data /*:any*/) => {
    if (data == null) {
        return data;
    }
    switch (typeof data) {
        case 'boolean':
            return Math.random() > 0.5;
        case 'number':
            return Math.random();
        case 'string':
            return Math.random().toString(36);
        case 'object':
            const res = {};
            Object.keys(data).forEach(k => {
                res[k] = randomValue(data[k]);
            });
            return res;
    }
};

const randomCrdt = (
    create: *,
    createDeepMap: *,
    value: *,
    hlcStamp: string,
) => {
    const rep = randomValue(value);
    if (rep != null && typeof rep === 'object') {
        return createDeepMap(rep, hlcStamp);
    }
    return create(rep, hlcStamp);
};

const get = (obj, path) => {
    for (let key of path) {
        obj = obj[key];
    }
    return obj;
};

const { check, permute } = require('./permute');

const generateDeltas = (create: *, createDeepMap: *, deltas: *, value: *) => {
    const keyPaths = allKeyPaths(value);
    const allDeltas = [];

    keyPaths.forEach(path => {
        const tick = makeTick();
        const isObject = path.value && typeof path.value === 'object';
        const makeDeltas = ticks => {
            const res = [
                deltas.set(
                    path.path,
                    randomCrdt(create, createDeepMap, path.value, ticks[0]),
                ),
                deltas.removeAt(path.path, ticks[1]),
            ];
            for (let i = 1; i < path.path.length; i++) {
                const sub = path.path.slice(0, -i);
                res.push(
                    deltas.removeAt(sub, ticks[i * 2]),
                    deltas.set(
                        sub,
                        randomCrdt(
                            create,
                            createDeepMap,
                            get(value, sub),
                            ticks[i * 2 + 1],
                        ),
                    ),
                );
            }
            if (isObject) {
                res.push(
                    deltas.set(path.path, create(5, ticks[ticks.length - 2])),
                    deltas.set(path.path, create(15, ticks[ticks.length - 1])),
                );
            }
            return res;
        };
        const ticks = [];
        for (let i = 0; i < path.path.length * 2; i++) {
            ticks.push(tick());
        }
        if (isObject) {
            ticks.push(tick());
            ticks.push(tick());
        }
        const theseDeltas = [];
        permute(ticks).forEach(times => {
            theseDeltas.push(makeDeltas(times));
        });
        allDeltas.push({ path, deltas: theseDeltas });
    });
    return allDeltas;
};

module.exports = {
    makeTick,
    allKeyPaths,
    randomValue,
    randomCrdt,
    generateDeltas,
};
