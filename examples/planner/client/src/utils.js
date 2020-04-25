// @flow

export const interleave = function <T>(items: Array<T>, fn: (number) => T): Array<T> {
    const res = [];
    items.forEach((item, i) => {
        if (i > 0) {
            res.push(fn(i));
        }
        res.push(item);
    });
    return res;
};
