# Ok folks here we are

## Things this is

Hello <bold>y'all</bold> wow this is it.

<em>Hello this is it y'all</em>

https://marijnhaverbeke.nl/blog/collaborative-editing.html


so, things we can do, with block level stuffs
split a block in two
join two adjacent blocks.

What happens if another block was inserted in between?
What does that mean?
I think it means that the second block is joined to the middle block?
Like, we've got "block start" tags, and we just delete that start.


Can we get away with "block start" tags being the main deals, and then
periodically have "block end" tags?
Do we even need "bock end" tags?
Ah yes, because we can have nesting.
Otherwise, we could just say "a block ends when another begins", which is essentially what Quill is doing.


Ok, but so like how do we merge:

<h1>hello all y'all</h1> (split before y'all)
->
<h1>hello all</h1>
<p>y'all</p>

and
<h1>hello all y'all</h1> (split before all)
->
<h1>hello</h1>
<p>all y'all</p>

I assume the answer here is
<h1>hello</h1>
<p>all</p>
<p>y'all</p>

And we can also merge unsplitting either of them in a reasonable way.

Now, um, what about splitting & joining list items?

Also, how do I know when a thing starts and when it ends?
What does "splitting" a node look like?
With the current CRDT, it ended up making much more sense
to have 'override' tags, instead of only deleting a start or end tag.
Can I do the same for block-level stuff?
What would that mean?
Or do we have the "default", which ends up being put in paragraphs,



okkkk what if we have a "split" node?
That just indicates "the thing before and after are siblings"?
And then we have "child" and "unchild" nodes?

Would that deduplicate correctly?

hmm idk???



But a split node is nothing other than a '\n'. Right?
except it would be nice to also have a way to indicate a 'soft-newline'.

<blockquote>
Hello
<list>
Folks
</list>
Here</blockquote>

Yeah I think I can just treat it as a normal thing?
oh wait, what about the "join"?
yeah I don't have a way to do that erghhhh


