// how to do ordered arrays?
// great discussion here https://news.ycombinator.com/item?id=10957273
// basically, I'll try the "float" method, and see how that does.
// I guess the pathalogical case becomes "I can't get enough precision to put x between these two"
// but.... maybe I'll store them as a list of floats? so if I 'run out' of precision (e.g. the difference is less than some epsilon),
// then I can add a float to the array
/*::
export type SortedArray = {
    // the "key" here is the magic
    // hmm but then is removal allowed?
    [key: string]: Array<number>,
    // set arr['k'] = 4 at ts = 3
    // set arr['k'] = 6.5 at ts = 4
    // set arr['k'] = null at ts = 5
    // set arr['k'] = 3 at ts = 6
    // ok I think that's fine actually?
    // I mean, in my notablemind case, where the whole document is loaded into memory,
    // I might want to do the `parent: {id, order}` thing, and then have a cache of parent-child relationships
    // that I consult for speed.
};
*/

/*

Ok folks here's what we do.
You provide a schema, like
recipeSchema = {
    id: 'id',
    title: 'string',
    description: 'string',
    cooktime: 'int',
    ingredients: 'object', // don't merge
    ingredients: 'array', // don't merge
    instructions: [{
        id: 'id',
        sort: 'sort', // maybe? Or just auto-add `$sort`
        text: string,
    }],
    instructions: ['string'],
    instructions: ['id'],
}
And then we add delta commands for:
- array/insert (v, idx)
- array/push (v)
- array/reorder (id, idx)
- ORR wait maybe they aren't actually "delta"s, they're just things the wrapper exposes.
  yeah. So the wrapper knows about arrays.
  and knows about the schema. The crdt knows nothing about either. Just "plain"s and "map"s.
  which should be enough? Seems like.

OK so the only place this breaks down is if we want an optimized representation.
Like we store the array as sorted.
So {type: 'array', contents: Array<{id: string, sort: Sort, data: T}>} or something like that.
or maybe {type: 'map', contents: T, cachedSortedArray: Array<id>}
But we can probably cross that bridge when we come to it.
And javascript is fast. So it's fine.

- array/update -- actually 'set' will do that for us. You just need to refer to the id? hmm yeah.
               -- so maybe I won't do the ['string'] one. You can do ['id'] if you want.


// TODO is there a good way to do schema migrations?

*/

const sorted = ar => {
    return Object.keys(ar).sort((a, b) => compare(ar[a], ar[b]));
};

const epsilon = Math.pow(2, -10);

// 0, 0 is sorted *after* 0

const compare = (one: Array<number>, two: Array<number>) => {
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

const between = (one: ?Array<number>, two: ?Array<number>): Array<number> => {
    if (!one && !two) return [0];
    if (!one) return [two[0] - 1];
    if (!two) return [one[0] + 1];
    let i = 0;
    const parts = [];
    // console.log('between', one, two);
    for (; i < one.length && i < two.length; i++) {
        if (two[i] - one[i] > epsilon * 2) {
            // console.log('between', two[i] - one[i]);
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

const after = (one: Array<number>) => {
    return [one[0] + 1];
};

const before = (one: Array<number>) => {
    return [one[0] - 1];
};

const insert = (ar: SortedArray, k: string, left: string, right: string) => {
    ar[k] = between(ar[left], ar[right]);
};

const push = (ar: SortedArray, k: string) => {
    const keys = sorted(ar);
    if (keys.length === 0) {
        ar[k] = [0];
    } else {
        ar[k] = after(ar[keys[keys.length - 1]]);
    }
};

const unshift = (ar: SortedArray, k: string) => {
    const keys = sorted(ar);
    if (keys.length === 0) {
        ar[k] = [0];
    } else {
        ar[k] = before(ar[keys[0]]);
    }
};

module.exports = { insert, push, unshift, sorted, between };
