// @flow

import type { Delta } from './index';
import { type MapCRDT, type CRDT, create } from './index';
export type { MapCRDT, CRDT } from './index';

// how to do ordered arrays?
// great discussion here https://news.ycombinator.com/item?id=10957273
// basically, I'll try the "float" method, and see how that does.
// I guess the pathalogical case becomes "I can't get enough precision to put x between these two"
// but.... maybe I'll store them as a list of floats? so if I 'run out' of precision (e.g. the difference is less than some epsilon),
// then I can add a float to the array

export type Sort = Array<number>;

export type SortedArray = {
    // the "key" here is the magic
    // hmm but then is removal allowed?
    [key: string]: Sort,
    // set arr['k'] = 4 at ts = 3
    // set arr['k'] = 6.5 at ts = 4
    // set arr['k'] = null at ts = 5
    // set arr['k'] = 3 at ts = 6
    // ok I think that's fine actually?
    // I mean, in my notablemind case, where the whole document is loaded into memory,
    // I might want to do the `parent: {id, order}` thing, and then have a cache of parent-child relationships
    // that I consult for speed.
};

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
    console.log('Between', one, two);
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
            // console.log('between', two[i] - one[i]);
            // does this mean that this is the smallest possible difference between two things?
            // I don't know actually. Probably possible to construct scenarios that... hmm.. maybe not
            // though.
            parts.push(one[i] + (two[i] - one[i]) / 2);
            console.log(one[i], two[i], parts);
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

export const after = (one: Array<number>) => {
    return [one[0] + 1];
};

export const before = (one: Array<number>) => {
    return [one[0] - 1];
};

export const insert = (
    ar: SortedArray,
    k: string,
    left: string,
    right: string,
) => {
    ar[k] = between(ar[left], ar[right]);
};

export const push = (ar: SortedArray, k: string) => {
    const keys = sorted(ar);
    if (keys.length === 0) {
        ar[k] = [0];
    } else {
        ar[k] = after(ar[keys[keys.length - 1]]);
    }
};

export const unshift = (ar: SortedArray, k: string) => {
    const keys = sorted(ar);
    if (keys.length === 0) {
        ar[k] = [0];
    } else {
        ar[k] = before(ar[keys[0]]);
    }
};

// Ok, so maybe I'll bring out the "array soring and stuff" even further up, so you deal with it directly in the app?
// not sure about that, but seems like a decent place to start.
// But then again, I don't love the ergonomics, and `schema` wants to say things about arrays.

export const deltas = {
    set: (path: Array<string>, value: CRDT) => ({
        type: 'set',
        path,
        value,
    }),
    arrayInsert: (
        items: Array<{ $sort: Sort, ... }>,
        path: Array<string>,
        idx: number,
        value: MapCRDT,
    ): Delta => {
        idx = idx < 0 ? idx + items.length : idx;
        const newSort = between(
            items[idx] ? items[idx].$sort : null,
            items[idx + 1] ? items[idx + 1].$sort : null,
        );
        if (
            value.map.id.type !== 'value' ||
            typeof value.map.id.value !== 'string'
        ) {
            throw new Error('Need an id for an array item');
        }
        return {
            type: 'set',
            path: path.concat([value.map.id.value]),
            value: {
                ...value,
                map: { ...value.map, $sort: create(newSort, value.hlcStamp) },
            },
        };
    },
    arrayReorder: (
        items: Array<{ $sort: Sort, ... }>,
        path: Array<string>,
        id: string,
        idx: number,
        ts: string,
    ): Delta => {
        idx = idx < 0 ? idx + items.length : idx;
        const newSort = between(
            items[idx] ? items[idx].$sort : null,
            items[idx + 1] ? items[idx + 1].$sort : null,
        );
        return {
            type: 'set',
            value: create(newSort, ts),
            path: path.concat([id, '$sort']),
        };
    },
};

// export const encode = (t: Type, v: any): any => {
//     if (!v) return v;
//     if (Array.isArray(v)) {
//         const res = {};
//         const unsorted = v.filter(item => !item.$sort);
//         v.forEach(item => {
//             res[item.id] = item;
//         });
//     } else if (typeof v === 'object') {
//         const res = {};
//         Object.keys(v).forEach(k => (res[k] = encode()));
//     }
// };

export const decode = (t: Type, v: any): any => {
    if (!v) return v;
    if (typeof t === 'string') {
        return v;
    }
    const res = {};
    if (t.type === 'array') {
        return Object.keys(v)
            .map(k => decode(t.item, v[k]))
            .sort((a, b) => compare(a.$sort, b.$sort));
    } else if (t.type === 'object') {
        Object.keys(res).forEach(k => (res[k] = decode(t.attributes[k], v[k])));
    } else if (t.type === 'map') {
        Object.keys(res).forEach(k => (res[k] = decode(t.value, v[k])));
    } else {
        return v;
    }
    return res;
};

import type { Type } from './schema';
export const value = (t: Type, crdt: CRDT) => {
    if (crdt.type === 'plain') {
        return crdt.value;
    } else if (typeof t === 'object') {
        if (Array.isArray(t)) {
            // if (t[[0] === 'id')
            const objects: Array<any> = Object.keys(crdt.map).map(k =>
                value(t[0], crdt.map[k]),
            );
            objects.sort((a, b) => compare(a.$sort, b.$sort));
            return objects;
        } else if (t.type === 'map') {
            const map = {};
            Object.keys(crdt.map)
                .sort()
                .forEach(k => {
                    map[k] = value(t.value, crdt.map[k]);
                });
            return map;
        } else if (t.type === 'object') {
            const map = {};
            Object.keys(crdt.map)
                .sort()
                .forEach(k => {
                    map[k] = value(t.attributes[k], crdt.map[k]);
                });
            return map;
        } else {
            throw new Error(`Invalid schema: ${JSON.stringify(t)}`);
        }
    } else {
        throw new Error('Value does not match the schema');
    }
};

// module.exports = { insert, push, unshift, sorted, between };
