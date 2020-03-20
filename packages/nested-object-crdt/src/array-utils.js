// @flow

export type Sort = Array<number>;

const epsilon = Math.pow(2, -10);

export const insertionIndex = (
    ids: Array<string>,
    sortForId: string => Sort,
    newSort,
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
    if (i < one.length - 1) {
        return -1;
    }
    if (i < two.length - 1) {
        return 1;
    }
    return 0;
};

export const between = (
    one: ?Array<number>,
    two: ?Array<number>,
): Array<number> => {
    if (!one || !two) {
        if (one) return [one[0] + 1];
        if (two) return [two[0] - 1];
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
    if (i < one.length - 1) {
        // is this possible? it would mean that two is less than one I think...
        parts.push(one[i] + 1);
    } else if (i < two.length - 1) {
        parts.push(two[i] - 1);
    } else {
        parts.push(0);
    }
    return parts;
};
