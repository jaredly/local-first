// Based on RGA
// And this great explanation
// https://www.youtube.com/watch?v=yCcWpzY8dIA

type CRDT<Format> = {|
    items: Array<Span<Format>>,
|};

type Span<Format> = {|
    id: [number, string],
    left: [number, string],
    text: string,
    deleted?: boolean,
    // TODO merging formats might be a little dicey?
    // I'll parameterize on it, -- you provide your own "format" crdt
    format?: Format,
|};

type MergeFormats<Format> = (Format, Format) => Format;

export const insert = (crdt, span) => {
    const [id, site] = span.left;
    for (let i = 0; i < crdt.items.length; i++) {
        const item = crdt.items[i];
        console.log(item.id, span.left);
        if (
            item.id[0] === id &&
            item.id[1] === site &&
            item.text.length === 1
        ) {
            for (let j = i + 1; j < crdt.items.length; j++) {
                const two = crdt.items[j];
                if (two.id[0] < span.id[0]) {
                    crdt.items.splice(j, 0, span);
                    return;
                }
            }
            // TODO follow the afters in case they're larger
            crdt.items.push(span);
            return;
        } else if (
            item.id[1] === site &&
            item.id[0] <= id &&
            item.id[0] + item.text.length > id
        ) {
            const delta = id - item.id[0] + 1;
            const pre = { ...item, text: item.text.slice(0, delta) };
            const post = {
                ...item,
                text: item.text.slice(delta),
                id: [item.id[0] + delta, item.id[1]],
            };
            crdt.items.splice(i, 1, pre, span, post);
            // split
            return;
        }
    }
    console.log('failed!!');
};

export const format = (crdt, ids, format, merge) => {
    // TODO
};

export const del = (crdt, array) => {
    // TODO
};

export const applyDelta = (
    crdt: CRDT<Format>,
    delta: Delta<Format>,
    mergeFormats: MergeFormats<Format>,
) => {
    switch (delta.type) {
        case 'insert':
            insert(crdt, delta.span);
            break;
        case 'format':
            format(crdt, delta.array, delta.format, mergeFormats);
            break;
        case 'delete':
            del(crdt, delta.array);
    }
};

type Delta<Format> =
    | {
          type: 'insert',
          span: Span<Format>,
      }
    | {
          type: 'format',
          // [idnum, sitenum, spanlength]
          array: Array<[number, string, number]>,
          format: Format,
      }
    | {
          type: 'delete',
          array: Array<[number, string, number]>,
      };

export const init = () => ({ items: [] });
export const toString = d => d.items.map(m => m.text).join('');

const toKey = ([id, site]) => `${id}:${site}`;

const assemble = (afters, spans, dest) => {
    spans.sort((a, b) =>
        a.id[0] === b.id[0] ? cmp(a.id[1], b.id[1]) : b.id[0] - a.id[0],
    );
    spans.forEach(span => {
        const [id, site] = span.id;
        if (span.text.length === 1) {
            dest.push(span);
            const key = toKey(span.id);
            if (afters[key]) {
                assemble(afters, afters[key], dest);
            }
        } else {
            let last = 0;
            for (let i = 0; i < span.text.length; i++) {
                // const key = toKey([span.id[0] + i, span.id[1]]);
                // if (afters[key])
                // assemble(afters, )
            }
            if (last === 0) {
                dest.push(span);
                const key = toKey(span.id);
                if (afters[key]) {
                    assemble(afters, afters[key], dest);
                }
            } else {
                const lastId = [id + last, site];
                const lastSpan = {
                    ...span,
                    text: span.text.slice(last),
                    id: lastId,
                };
                dest.push(span);
                const key = toKey(lastId);
                if (afters[key]) {
                    assemble(afters, afters[key], dest);
                }
                //
            }
        }
    });
};

export const merge = (
    one: CRDT<Format>,
    two: CRDT<Format>,
    mergeFormats: (Format, Format) => Format,
): CRDT<Format> => {
    const afters = {};
    one.items.forEach(span => {
        const before = toKey(span.left);
        if (!afters[before]) {
            afters[before] = [span];
        } else {
            afters[before].push(span);
        }
    });
    const items = [];
    let currents = ['0:root'];
    while (currents.length) {}
};
// insert
// delete
// format

/*
## General outline, of my "not-woot"

id consists of 3 parts
- siteID (unique per client)
- counter (unique within a client, increasing by 1 each time)
- sort (for causality on the right side)

A node consists of
- id
- after (reference to the character to the left)
- contents (a character & metadata potentially)
- deleted (bool)

a:1:0 after "root" 'h'
a:2:0 after "a:1:0" 'e'
a:3:0 after "a:2:0" 'l'

^ can be "compressed" into
a:1:0 after "root" 'hel'
as long as, for each character after the first one, 
- the "sorts" are all zero, 
- and the "counts" are increasing by one, in order.
- and the `deleted`s are all the same as that of the first one
  (all true or all false)

This means that the original can be fairly easily recovered.

then a comes in and adds
a:4:0 after "root" 'm'
- but wait! There's already a node after 'root', so the "sort" has to be 1+the max sort after root.
So it's a:4:1

and then b:
b:1:1 after a:2:0 'j' (1 because there's already something after a:2:0)
b:2:0 after b:1:1 'k'
b:3:0 after b:2:0 'l'

^ this can be compressed into
b:1:1 after a:2:0 'jkl'

What happens when two clients simultaniously add something after something else? Then they are sorted by clientID, it's fine.
I could also add timestamps / HLC stamps, but that seems like it might be overkill...



> ok so on-disk representation is

[
    {id: 'a:4:1', after: 'root', char: 'm'},
    {id: 'a:1:0', after: 'root', char: 'he'},
    {id: 'b:1:1', after: 'a:2:0', char: 'jkl'}
    {id: 'a:3:0', after: 'a:2:0', char: 'l'},
]

so we maintain them in sort order probably.
but wow this will probably be a bunch of code.
And can any current editors handle it? draft? quill?
Or should I do the thing where i have a shadow representation,
and update the editor's text based on it?







## And my "not-logoot"

Ids indicate sort order, an encode causality.

010:a 'h'
020:a 'e'
030:a 'l'

^ can be compressed into `a:000 'hel'` as long as the
IDs are incrementing in the expected fashion (in this case +36 each time)

then 00a:a 'm'

and then b
02a:b 'j'
02b:b 'k'
02c:b 'l'

Yeah I don't love the math involved here :/
it seems like it would be too easy to fall into a weird condition.



*/
