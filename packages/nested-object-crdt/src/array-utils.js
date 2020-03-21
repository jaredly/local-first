// @flow

export type Sort = Array<number>;

const epsilon = Math.pow(2, -10);

export const sortForInsertion = (
    ids: Array<string>,
    sortForId: string => Sort,
    idx: number,
) => {
    const pre = idx === 0 ? null : sortForId(ids[idx - 1]);
    const post = idx >= ids.length ? null : sortForId(ids[idx]);
    return between(pre, post);
};

export const insertionIndex = (
    ids: Array<string>,
    sortForId: string => Sort,
    newSort: Sort,
) => {
    for (let i = 0; i < ids.length; i++) {
        if (compare(sortForId(ids[i]), newSort) > 0) {
            return i;
        }
    }
    return ids.length;
};

export const compare = (one: Array<number>, two: Array<number>) => {
    let i = 0;
    for (; i < one.length && i < two.length; i++) {
        if (Math.abs(one[i] - two[i]) > Number.EPSILON) {
            return one[i] - two[i];
        }
    }
    if (one.length !== two.length) {
        return one.length - two.length;
    }
    return 0;
};

export const between = (
    one: ?Array<number>,
    two: ?Array<number>,
): Array<number> => {
    if (!one || !two) {
        if (one) return [one[0] + 10];
        if (two) return [two[0] - 10];
        return [0];
    }
    let i = 0;
    const parts = [];
    // console.log('between', one, two);
    for (; i < one.length && i < two.length; i++) {
        if (two[i] - one[i] > epsilon * 2) {
            // does this mean that this is the smallest possible difference between two things?
            // I don't know actually. Probably possible to construct scenarios that... hmm.. maybe not
            // though.
            parts.push(one[i] + (two[i] - one[i]) / 2);
            return parts;
        }
        parts.push(one[i]);
    }
    if (one.length < two.length) {
        parts.push(two[i] - 10);
    } else if (two.length < one.length) {
        parts.push(one[i] + 10);
    } else {
        parts.push(0);
    }
    return parts;
};
