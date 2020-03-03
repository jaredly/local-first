// @flow
import deepEqual from 'fast-deep-equal';
import type { Content, CRDT, Node, Delta } from './types';

import { posToLoc, idAfter, formatAt } from './loc';

// TODO should I accept a formatting thing?
// Yes, because insertion point (e.g. before or after the start of
// a formatting tag) is dependent on what formats I want to exist.
export const insert = (
    state: CRDT,
    at: number,
    text: string,
    format: ?{ [key: string]: any } = null,
) => {
    const loc = posToLoc(state, at, true, format);
    const afterId = idAfter(state, loc);

    state.largestLocalId = Math.max(loc.id, afterId, state.largestLocalId);
    // If currentFormat is missing things, then add new tags.
    // first ID for starting tag, second ID for ending tag,
    // third ID for the text itself, so it's contiguous.
    const nodes = [];
    let currentAfter = [loc.id, loc.site];
    const addNode = content => {
        const id = state.largestLocalId + 1;
        if (content.type === 'text') {
            state.largestLocalId += content.text.length;
        } else {
            state.largestLocalId += 1;
        }
        nodes.push({ after: currentAfter, id: [id, state.site], content });
        currentAfter = [id, state.site];
    };

    // If no format map is provided, take the current format
    if (format) {
        const currentFormat = formatAt(state, loc);
        // Ugh how do I... take care of things?
        // like, actually inserting a closing tag
        // is a bad idea, right?
        // Or wait, maybe it's good?
        // What's the difference between:
        // <open:b:true>ho folks</close:b:true>
        // -> v1
        // <open:b:true>ho<open:b:false>yes</close:b:false> folks</close:b:true>
        // -> v2
        // <open:b:true>ho</close:b:true>yes<open:b:true> folks</close:b:true>
        // Conceptually, I think the second is better.
        // Ok but so what if there's a competing value?
        // <open:h:goog>ho</close:h:goog><open:h:twit>yes</close:h:twit><open:b:goog> folks</close:b:goog>
        // <open:h:goog>ho<open:h:twit>yes</close:h:twit> folks</close:b:goog>
        // The second one is "simpler", includes fewer nodes.
        // but requires resolution of overlapping formats.
        // however, merging will require such resolution, so I'll have to build
        // that anyway.
        // Ok, so if it's a competing value (or a new value), we do a nested tag
        // If it's a missing value, we do the "close & reopen" thing
        Object.keys(currentFormat).forEach(key => {
            if (!(key in format)) {
                addNode({ type: 'close', key, value: currentFormat[key] });
            }
        });
        Object.keys(format).forEach(key => {
            if (!deepEqual(currentFormat[key], format[key])) {
                addNode({ type: 'open', key, value: format[key] });
            }
        });
        addNode({ type: 'text', text });
        Object.keys(format).forEach(key => {
            if (!deepEqual(currentFormat[key], format[key])) {
                addNode({ type: 'close', key, value: format[key] });
            }
        });
        Object.keys(currentFormat).forEach(key => {
            if (!(key in format)) {
                addNode({ type: 'open', key, value: currentFormat[key] });
            }
        });
        // Ok, order of things
        // </close></the></things></that>
        // Ok, so we *should* close our tags in the
        // same order as they're opened, right?
        // Is that something that it makes sense
        // to enforce though? Because we'll have to
        // do some normalize on the flip side I believe.
        // Because merges can easily break that invariant.
    } else {
        addNode({ type: 'text', text });
    }

    // NOTE and interesting case, for posToLoc:
    // if we have <em>Hi</em><strong>folks</strong>
    // at = 2, format = {em: true, strong: true}
    // then we could choose to be within the <em> and
    // add a strong, or we could be within the strong and
    // add an <em>. I'll decide to bias left, and go with
    // the former.

    // Ok, so if we have multiple format things, does it matter
    // which is applied first? I'll assume no.

    return {
        type: 'update',
        insert: nodes,
    };
};

export const del = (state: CRDT, at: number, length: number): Delta => {
    // TODO
    return { type: 'update', delete: [] };
};

export const format = (
    state: CRDT,
    at: string,
    length: number,
    key: string,
    value: any,
): Delta => {
    const nodes = [];
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
    // TODO
    return { type: 'update', insert: nodes };
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



*/
