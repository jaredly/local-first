// @flow

/**
 * This implementation of the [Hybric Logical Clocks][1] paper was very much based
 * on [this go implementation][2] and [james long's demo][3]
 *
 * [1]: https://muratbuffalo.blogspot.com/2014/07/hybrid-logical-clocks.html
 * [2]: https://github.com/lafikl/hlc/blob/master/hlc.go
 * [3]: https://github.com/jlongster/crdt-example-app/blob/master/shared/timestamp.js
 */

export type HLC = {
    ts: number,
    count: number,
    node: string,
};

export const pack = ({ ts, count, node }: HLC) => {
    // 13 digits is enough for the next 100 years, so 15 is plenty.
    // And 5 digits base 36 is enough for more than 6 million changes.
    return (
        ts.toString().padStart(15, '0') +
        ':' +
        count.toString(36).padStart(5, '0') +
        ':' +
        node
    );
};

export const unpack = (serialized: string) => {
    const [ts, count, ...node] = serialized.split(':');
    return {
        ts: parseInt(ts),
        count: parseInt(count, 36),
        node: node.join(':'),
    };
};

export const init = (node: string, now: number): HLC => ({
    ts: now,
    count: 0,
    node,
});

export const cmp = (one: HLC, two: HLC) => {
    if (one.ts == two.ts) {
        if (one.count === two.count) {
            if (one.node === two.node) {
                return 0;
            }
            return one.node < two.node ? -1 : 1;
        }
        return one.count - two.count;
    }
    return one.ts - two.ts;
};

export const inc = (local: HLC, now: number): HLC => {
    if (now > local.ts) {
        return { ts: now, count: 0, node: local.node };
    }

    return { ...local, count: local.count + 1 };
};

export const recv = (local: HLC, remote: HLC, now: number): HLC => {
    if (now > local.ts && now > remote.ts) {
        return { ...local, ts: now, count: 0 };
    }

    if (local.ts === remote.ts) {
        return { ...local, count: Math.max(local.count, remote.count) + 1 };
    } else if (local.ts > remote.ts) {
        return { ...local, count: local.count + 1 };
    } else {
        return { ...local, ts: remote.ts, count: remote.count + 1 };
    }
};

// This impl is closer to the article's algorithm, but I find it a little trickier to explain.
// export const recv = (time: HLC, remote: HLC, now: number): HLC => {
//     const node = time.node;
//     const ts = Math.max(time.ts, remote.ts, now);
//     if (ts == time.ts && ts == remote.ts) {
//         return { node, ts, count: Math.max(time.count, remote.count) + 1 };
//     }
//     if (ts == time.ts) {
//         return { node, ts, count: time.count + 1 };
//     }
//     if (ts == remote.ts) {
//         return { node, ts, count: remote.count + 1 };
//     }
//     return { node, ts, count: 0 };
// };

const maxPackableCount = parseInt('zzzzz', 36);

const validate = (time: HLC, now: number, maxDrift: number = 60 * 1000) => {
    if (time.count > maxPackableCount) {
        return 'counter-overflow';
    }
    // if a timestamp is more than 1 minute off from our local wall clock, something has gone horribly wrong.
    if (Math.abs(time.ts - now) > maxDrift) {
        return 'clock-off';
    }
    return null;
};
