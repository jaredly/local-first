Tag-capable text crdt

// the prosemirror way

Ok, there are only like 3 operations?
- ReplaceStep (which also does insert)
- ReplaceAroundStep (for creating block elements it seems)
  it does appear that block delimeters do take up "space" as it were.
  1 for the start and 1 for the end
- AddMarkStep
- RemoveMarkStep


hm
So, can I use the data structure I already know and love?
Can I handle block elements?
ReplaceStep also does "split this node", which is very interesting.

So my current deltas of "insert", "delete", and "format"
might need "insertMark"? Which inserts indicators in two places?
Because inserting just one is invalid.
Either that, or the 'insert' command needs to take a list of things to insert.
Which could be fine.

So, can I say:
<blockquote>
<h1> <strong> <em> hello </em> folks </strong> yes </h1>
</blockquote>

<blockquote>
<h1> <strong> <em> hello </em></h1>
<p>folks </strong> yes </p>
</blockquote>

is convertible into a linear state?
Also, are there merges that would result in invalid state?

Say I split the header on one client, and split it somewhere else
on another.

So then we have nested H1s I believe, if I do the "delete
the node delimiters and create new ones" approach.
So that's not awesome.

Yeah I wonder how yjs manages
two people bolding overlapping areas.


Do I need some explicit representation of the tree structure?
I would still have the issue of merging two "header splits"
probably.



Ok so an alternate representation:
There are zero-length delimeters inserted, but the actual
state about tree structure lives elsewhere, with nodes that
are tagged by ID.
And so the "split" is instead a "move the right side to this closer
thing, and create a new header right after it"...
No maybe that doesn't help?

Hmm, quill's "the newline is the thing the formats a block element" is pretty solid, actually.

hmmm could I do a similar thing?
or....
....
so, how would we do things like nested blocks.


(thinking about the "how to do a multiline blockquote" issue)
So, here's an idea.
We've only got newlines, right?
So we could have a special "joiner" flag on the newlink blockquote format.
And if the line after that line is also a blockquote, then they are joined.
Otherwise they are not.
Now, if the one after it isn't a blockquote, and then turns into a blockquote, then behavior might be a little unexpected. But I think it'd be OK?

Anyway, we're inferring a decent amount from context here.


Ok, so I'm sold on the "newlines are the whole deal" bit for block quotes.
But then I probably want to move my "general formatting" from the characters themselves to be delimeters. Because, even though it's less ~elegant, it does solve the "new characters inserted in the middle don't inherit formatting changes of the other client", resulting in non-contiguous stuff.


Wait, so I need to know how yjs reconciles
Hello *wolrd*.
with
Hell*o worl*d.

ohhh so yeah, multiple starts don't count, and trailing "ends" also don't count.

But it just means that you have to undo any trailing "ends" that you step over.
Ok, I guess that's fine. Certainly not ideal ...
But maybe better than the alternative?
maybe?

hmm actually maybe it's just as bad.

So, if:
*Hello world*
And
Hell*o w*orld
get resolved to
*Hello w*orld

Is that really "worse" than someone adding text in the middle, and it not being bolded?
I would say that my version does less to "lose intent".

Ok, so what if instead, I use IDs?
yeah actually maybe that's the answer.
That's how we preserve causality & intent.

So a start will only end when it encounters an end with a matching ID.
This'll make the algorithm a little (rather) more complicated.
But I think it's what's required.


<div>
    <h1 a>
    hello folks
    </h1 a>
</div>

<div>
    <h1 a>
    hello
    </h1 a>
    <h1 b>
    folks
    </h1 b>
    <!-- </h1 a> -->
</div>

// ORR if you're splitting it, you can reuse the ID?
// because we know they won't overlap

<div>
    <h1 a>
    hello
    </h1 a>
    <h1 a>
    folks
    </h1 a>
    <!-- </h1 a> -->
</div>

// One way

<div>
    <h1 a>
    he
    </h1 a>
    <h1 c>
    llo folks
    </h1 c>
</div>

/// Merged

<div>
    <h1 a>
    he
    </h1 a>
    <h1 c>
    llo
    </h1 a>
    <h1 b>
    folks
    </h1 c>
    </h1 b>
    <!-- </h1 a> -->
</div>

// The other way

<div>
    <h1 a>
    he
    </h1 a>
    <h1 a>
    llo folks
    </h1 a>
</div>






















// the slate way

If I can come up with a linearization of a tag setup that works,
then this should be alright.

So, the insertTextOperations work fine for me.
Butwhat of the node operations?

-   insert
-   merge
-   move
-   remove
-   setNode
-   splitNode

When are these used?

# "bold" then "insert"

-   split (to make room for the new node)
-   insert (bold: true, text: 'h')

# "select" then "bold"

-   split + split
-   set_node (bold: true)

# "select" then "unbold"

-   set_node (bold: undefined)
-   join + join

# "select" the bolded region, then "underline"

-   set_node

why does split_node have properties?

oooooh move_node is bad news.
well, what I can do is...
erm yeah not loving the look of this.
I tried doing drag-to-move some text, and it was a mess.

Maybe prosemirror is better?
b/c slate isn't making things work.
Yeah let's try that out.

hrm

```

export type NodeOperation =
  | InsertNodeOperation
  | MergeNodeOperation
  | MoveNodeOperation
  | RemoveNodeOperation
  | SetNodeOperation
  | SplitNodeOperation

export type TextOperation = InsertTextOperation | RemoveTextOperation

export type Operation = NodeOperation | TextOperation

export type InsertNodeOperation = {
  type: 'insert_node'
  path: Path
  node: Node
  [key: string]: any
}

export type InsertTextOperation = {
  type: 'insert_text'
  path: Path
  offset: number
  text: string
  [key: string]: any
}

export type MergeNodeOperation = {
  type: 'merge_node'
  path: Path
  position: number
  target: number | null
  properties: Partial<Node>
  [key: string]: any
}

export type MoveNodeOperation = {
  type: 'move_node'
  path: Path
  newPath: Path
  [key: string]: any
}

export type RemoveNodeOperation = {
  type: 'remove_node'
  path: Path
  node: Node
  [key: string]: any
}

export type RemoveTextOperation = {
  type: 'remove_text'
  path: Path
  offset: number
  text: string
  [key: string]: any
}

export type SetNodeOperation = {
  type: 'set_node'
  path: Path
  properties: Partial<Node>
  newProperties: Partial<Node>
  [key: string]: any
}

export type SetSelectionOperation =
  | {
      type: 'set_selection'
      [key: string]: any
      properties: null
      newProperties: Range
    }
  | {
      type: 'set_selection'
      [key: string]: any
      properties: Partial<Range>
      newProperties: Partial<Range>
    }
  | {
      type: 'set_selection'
      [key: string]: any
      properties: Range
      newProperties: null
    }

export type SplitNodeOperation = {
  type: 'split_node'
  path: Path
  position: number
  target: number | null
  properties: Partial<Node>
  [key: string]: any
}

```
