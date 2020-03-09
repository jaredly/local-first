// @flow
import deepEqual from 'fast-deep-equal';
import type { Content, CRDT, Node, TmpNode, Delta, Loc } from './types';

import { selectionToSpans } from './span';
import { getFormatValues, toKey, keyEq } from './utils';
import {
    posToLoc,
    idAfter,
    formatAt,
    adjustForFormat,
    nodeForKey,
    walkFrom,
    nextNode,
    prevSibling,
    rootSite,
    lastId,
} from './loc';

export const insert = (
    state: CRDT,
    at: number,
    text: string,
    newFormat: ?{ [key: string]: any } = null,
    genStamp: ?() => string,
): Array<Delta> => {
    const initialLoc = posToLoc(state, at, true);
    const loc = newFormat
        ? adjustForFormat(state, initialLoc, newFormat)
        : initialLoc;
    const afterId = idAfter(state, loc);

    state.largestLocalId = Math.max(loc.id, afterId, state.largestLocalId);

    const deltas = [];
    let nextId = state.largestLocalId + 1;
    let nextAfter = [loc.id, loc.site];
    // console.log('Insert', initialLoc, loc, nextId);
    if (newFormat) {
        const node = nodeForKey(state, [loc.id, loc.site]);
        const current = node ? getFormatValues(state, node.formats) : {};

        const addFormat = (key, value) => {
            const openNode = {
                after: nextAfter,
                id: [nextId, state.site],
            };
            nextId += 1;
            const closeNode = {
                after: openNode.id,
                id: [nextId, state.site],
            };
            nextId += 1;
            nextAfter = openNode.id;
            deltas.push({
                type: 'format',
                open: openNode,
                close: closeNode,
                key,
                value,
                stamp: genStamp
                    ? genStamp()
                    : Date.now()
                          .toString(36)
                          .padStart(5, '0'),
            });
        };

        Object.keys(newFormat).forEach(key => {
            if (
                newFormat[key] &&
                current[key] &&
                !deepEqual(newFormat[key], current[key])
            ) {
                addFormat(key, newFormat[key]);
            }
        });
        Object.keys(current).forEach(key => {
            if (current[key] && !(key in newFormat)) {
                addFormat(key, null);
            }
        });
    }
    deltas.push({
        type: 'update',
        insert: [
            {
                after: nextAfter,
                id: [nextId, state.site],
                text,
            },
        ],
    });
    state.largestLocalId = nextId + text.length - 1;

    return deltas;

    // NOTE and interesting case, for posToLoc:
    // if we have <em>Hi</em><strong>folks</strong>
    // at = 2, format = {em: true, strong: true}
    // then we could choose to be within the <em> and
    // add a strong, or we could be within the strong and
    // add an <em>. I'll decide to bias left, and go with
    // the former.
};

export const del = (state: CRDT, at: number, length: number): Delta => {
    const spans = selectionToSpans(state, at, at + length);
    // TODO if there are any covered format pairs, then remove them as well
    return { type: 'update', delete: spans };
};

// ✅ If the node "right after" this node is a text node, then bail
// ✅ if the node "right after" the end node is a text node, also bail
// move the end node along to the last "format close" node
// then collect all "full" formats, and all referenced formats.
// If there are more referenced formats than full, then bail
// Otherwise delete all the formats.
const maybeDeleteFormats = (
    state: CRDT,
    key: string,
    openNode,
    endLoc: Loc,
): ?Array<Delta> => {
    const start = nodeForKey(state, openNode.after);
    if (start) {
        if (lastId(start)[0] !== openNode.after[0]) {
            // we're in the middle of a text node
            return console.log('in the middle', start.id, openNode.after);
        }
    } else if (!keyEq(openNode.after, [0, rootSite])) {
        throw new Error(`no node ${openNode.after}`);
    }
    const startNext = start ? nextNode(state, start) : state.roots[0];
    if (!startNext) {
        return console.log('no next', start);
    }
    const startNextNode = state.map[startNext];
    if (startNextNode.content.type === 'text') {
        // Not right next to the start of a format
        return console.log('next is text', startNextNode.content);
    }
    const end = nodeForKey(state, [endLoc.id, endLoc.site]);
    if (!end) {
        throw new Error(`no end node`);
    }
    if (lastId(end)[0] !== endLoc.id) {
        // we're ending in the middle of a text node
        return console.log('end middle', end.id, endLoc);
    }
    let endId = [endLoc.id, endLoc.site];
    let current = end;
    while (true) {
        const nextKey = nextNode(state, current);
        if (!nextKey) {
            break;
        }
        current = state.map[nextKey];
        if (end.content.type === 'text') {
            break;
        }
        if (end.content.type === 'close') {
            endId = end.id;
        }
    }

    // if we're halfway in the middle of a node, forget about it.
    const stampToStart = {};
    const startToClose = {};
    const usedFormats = {};
    walkFrom(state, toKey(startNextNode.id), node => {
        const nodeKey = toKey(node.id);
        if (node.content.type === 'open' && node.content.key === key) {
            const stamp = node.content.stamp;
            stampToStart[stamp] = nodeKey;
            startToClose[nodeKey] = { stamp, open: node.id, close: null };
        }
        if (node.content.type === 'close' && node.content.key === key) {
            const start = stampToStart[node.content.stamp];
            if (startToClose[start]) {
                startToClose[start].close = node.id;
            }
        }
        if (node.formats[key]) {
            node.formats[key].forEach(startId => (usedFormats[startId] = true));
        }
        if (keyEq(node.id, endId)) {
            return false;
        }
    });
    if (
        Object.keys(usedFormats).some(
            k => !startToClose[k] || startToClose[k].close == null,
        )
    ) {
        // a format was used that isn't fully contained
        return;
    }
    if (Object.keys(startToClose).some(k => startToClose[k].close == null)) {
        // a format was started, but maybe not used? Unusual probably
        return;
    }

    return Object.keys(startToClose).map(k => ({
        type: 'delete-format',
        stamp: startToClose[k].stamp,
        open: startToClose[k].open,
        close: startToClose[k].close,
    }));
};

export const format = (
    state: CRDT,
    at: number,
    length: number,
    key: string,
    value: any,
    stamp?: string,
): Array<Delta> => {
    stamp =
        stamp ??
        Date.now()
            .toString(36)
            .padStart(5, '0');

    const loc = posToLoc(state, at, true);
    const afterId = idAfter(state, loc);
    state.largestLocalId = Math.max(loc.id, afterId, state.largestLocalId);
    const id = state.largestLocalId + 1;
    state.largestLocalId += 1;
    const openNode = {
        after: [loc.id, loc.site],
        id: [id, state.site],
    };

    const endLoc =
        length === 0
            ? { id: openNode.id[0], site: openNode.id[1], pre: true }
            : posToLoc(state, at + length, true);

    // Iff the full contents

    // Cases:
    // - the start is the middle of a word
    // - the dominant format is covering up another format:bold,
    //   such that deleting one layer would reveal the other.
    // - ugh this is feeling complicated.
    // - should I just do "if the span covered is literally an
    //   existing format (that is the "latest" format across the
    //   whole span), then nix it?"
    // - maybe that's the simplest thing that would work?
    // - oh wait, but then there's the "unbold could reveal a
    //   previously covered-up bold"
    // - so a simpler thing -- if the span covered completely
    //   matches an existing format, and the contents don't have
    //   any other formats for that key, then delete the format.
    // What's an elegant way to fuzz the start & end?
    // for the end, maybe do walkFrom(`idAfter`)? Seems like that
    // would work. Same with `start` tbh.
    //
    // We're removing a format

    if (value == null) {
        const deleteFormats = maybeDeleteFormats(state, key, openNode, endLoc);
        if (deleteFormats) {
            return deleteFormats;
        }
    }
    // collect all format spans that are encompassed by this range
    // go through each text node in the interim, and find out what
    // allegiences they have (format nodes that impact them)
    // if there are any which aren't fully covered

    // I want to be *after* any other "end"s
    // let end = endLoc;
    // walkFrom(state, toKey([endLoc.id, endLoc.site]), node => {
    //     if (node.content.type !== 'end') {
    //         return false;
    //     }
    //     // endLoc.id = node.id[0];
    //     // endLoc.site = node.id[1];
    // });
    const endAfterId = length === 0 ? afterId : idAfter(state, endLoc);
    state.largestLocalId = Math.max(
        endLoc.id,
        endAfterId,
        state.largestLocalId,
    );
    const endId = state.largestLocalId + 1;
    state.largestLocalId += 1;
    const closeNode = {
        after: [endLoc.id, endLoc.site],
        id: [endId, state.site],
    };

    return [
        {
            type: 'format',
            open: openNode,
            close: closeNode,
            key,
            value,
            stamp,
        },
    ];

    // currentAfter = [id, state.site];
    // Ok, need to determine what spans to format around, right?
    // Like, if you have "*Hello* world" and you select the whole
    // thing, and press "italic", should it merely extend the italic
    // around hello?
    /*
    
    I> Hello world
    A> *Hello* world
    - sync -
    A> Hello world
    B> *Hello world*
    - sync -
    What should result?
    - if B "extends the italics", then A would win, the formatting is removed, and we have a trailing closing italic, which could mess things up down the road?
    - if B creates an italic around " world", then the result is "Hello* world*", which could be intuitive?
    - if B creates a larger italic around the whole thing, then the result is the whole thing is still italicized, which I think also makes sense.
      - B would probably delete the inner italic at this point too, because unitalicizing the whole thing shouldn't "fall back" to the previous smaller italics, I believe.
    Ok, so extending the italics is just out.

    So, do I want
    - *Hello world*
    or
    - Hello* world*

    ...

    This is the function that makes all the difference.

    Ok, so another case:

    I> This is good
    - sync -
    A> This *is good*
    - sync -
    B> |This *is| good*  // selected "This is" and italicized
    - sync -

    What I think we want is
    <i>this <i>is</i> good</i>
    ? is that right?
    That's certainly what we would get in the out-of-sync case,
    so might as well be prepared to deal with it.

    Clearly, the whole region should be italicized.

    The two approaches:
    - for the highlighted area, remove conflicting formatting and then surround

    Also there are probably some decisions to make when removing formatting as well.

    ok, maybe this is just prohibitively complicated?
    As in, there are more unexpected edge cases with this method...

    Ok, so one simple method:
    - if adding a format, just drop in a new tag at the start & end 
      - can go in from the ends if the format already exists at the ends
    - if removing a format, delete ... any formats ... that exist ...
      - delete any that overlap
      - and then re-create smaller ones
        - yeah but so many weird edge cases!

    ugh is there a better way to arrange things?
    Ok what if the ... end tag ... yeah it does have to exist



    */
};

/*

Edge cases that will result in unanticipated behavior:

The Quill method:

I> Hello world
A> *Hello* world
B> He---llo world
- sync -
--> *He*---*llo* world

The tags method:

I> *Hello* world
A> i(Hello world)
B> noi(Hello)
- sync -
--> Hello* world*

I> *a b c* d
A> noi(b c d)
B> noi(a b c)
- sync -
--> This will probably result in "*a* b c d"
--> if A's noi recreates the italics around 'a'
--> if it's just deletes & recreates the closing tag,
--> then the result will be no italics, but with an
--> orphan tag laying around that would probably cause
--> weird issues

--> with the quill method, this one works just fine.



## Ok, marks and dots

marks: {} map, where 'start' and 'end' have a dot ID
  -> starts & ends *can be moved*, with an HLC for last-write-wins.

I> .a b c. d (with a mark saying between those dots is italic)
A> noi(b c d)
   .a .b c. d (the first mark has the endpoint changed to point
               to this new dot before b)
B> noi(a b c)
   the mark is deleted, never to return

--------

I> .a b c. d (with a mark saying between those dots is italic)
A> noi(b c d)
   .a .b c. d (the first mark has the endpoint changed to point
               to this new dot before b)
B> noi(a b)
   .a b .c. d (the mark's start is moved to a new dot before c)
--> the mark's start is after its end, so it does nothing.

It works!

I> Hello world
A> .Hello. world
B> He---llo world
- sync -
R> .He---llo. world

I> .a. b .c. d
A> i(a b c) -- we can't "join" two marks, so what happens?
Options
- delete the second mark, move first mark's endpoint to after c
- delete the first mark, move the second mark's start to before a
- create a new mark from the first mark's endpoint to the second one's startpoint
- expand the first mark to before c (to meet the second mark)
- expand the second mark to after a (to meet the first mark)
- delete both marks, create a new one from the start of a to the end of c

- any of the results that involve deleting one or the other
  would conflict with methods that extend marks.
  Because if we delete the second mark, and then anther client
  extends that mark to format more of the sentence, then we're
  busted.

The one that best preserves the "it mostly makes sense" of the Quill method is:
- create a new mark for the in-between bits.

Ok, so cautious principles:
- when adding format, create a mark for each contiguous region that needs the format.
- when removing format, resize marks on the edges if needed, and delete marks that are fully contained.

------

I> a b c d
A> i(a b c)
B> i(b c d)
- sync -
R> .a .b c. d.
with two overlapping marks.
one thing that's nice is that it's clear that it's two separate
marks, and not one mark within another one.
A> noi(c d)
  .a .b .c. d.
  with both marks backed up to before c?
  I guess that works?

This is just megacomplicated though.

Ok but it does address the various issues better than the other
ones though.



I> a b c d
A> i(a b c d)
- sync -
A> noi(b c)
B> noi(a b c d)
- sync -
R> .a .b c. d.

dangggg this results in " d" still be italicized.
Which nobody wanted.

Does that mean that a mark should have multiple spans?
ugh that makes it even more complicated.

Ok, so the other way to do it is, instead of deleting marks, we just overwrite them.

That ... makes things rather simpler?
Maybe.
It's got a simplicity I like.





Ummm then do we need the dots and marks?
Like I think we probably don't, we can go back to open/close
tags, and just ... never delete them? I guess if their contents get deleted, we can delete them too.
Or if the full thing is selected and then deleted.

So, those scenarios again, how would they fare?

I> Hello world
A> *Hello* world
B> He---llo world
--> *He---llo* world

I> *Hello* world
A> i(Hello world)
B> noi(Hello)
- sync -
--> Hello* world*
but tbh I think that's the right way to do it.

I> *a b c* d
A> noi(b c d)
B> noi(a b c)
- sync -


ummm so there's a problem maybe?
How do we know presedence?

oh wait we can use our fancy causal ordering technique!
yes, so when adding format nodes, use `largestGlobalId`,
and when adding text nodes, use `largestLocalId`?
hmmm maybe that makes things more complicated

maybe add a timestamp?
yeah, I could do an HLC if I wanted, but honestly it's probably
not a big deal? Although, why not, right?

Yes, let's do an HLC there. ... I think?
Also do we need to make sure that.

I> *a* b c *d* e *f*
A> noi(a b c d) // umm no it'll really just be noi(a) noi(d)
B> i(b c)

<1>a <2>b c</2> d</1>
<1>a <2>b c</1> d</1>

Ok, so you got to know: 
1) what takes precedence over what, and
2) when something ends. So the start & stop have HLC timestamps that are the IDs.

And I think that should preserve intent as well as may be?

What would happen if I just straight up add things?
And then go back later (as a treat) to remove some things?

Ah ok so for the first pass I can ... umm ... do insert(text) and then format(that range)?
If the formats don't exist.
*/
