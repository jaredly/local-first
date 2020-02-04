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
