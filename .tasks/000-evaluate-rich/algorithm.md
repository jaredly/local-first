# Rich Text CRDT Algorithm

This document explains the algorithm implemented in `packages/rich-text-crdt`. It describes the current code rather than an idealized future version.

## Big Picture

The CRDT represents a rich-text document as an ordered tree of nodes. Each inserted text character and each formatting marker has a stable logical ID. Text deletion does not remove identity from the document; it tombstones text nodes. Formatting is represented with open and close marker nodes, similar to tags in a stream.

The visible document is produced by walking the tree in order:

- Text nodes contribute their text unless they are deleted.
- Format open markers add an active formatting value.
- Format close markers remove the matching active formatting value.
- Each text node carries a cached `formats` map describing the active formatting at that point.

Replicas can exchange operation deltas or merge whole states. The merge algorithm reconstructs a canonical tree by breaking both states into atomic nodes, unioning them by ID, and rebuilding order from each atom's predecessor relationship.

## State Shape

A CRDT state has three fields:

```ts
type CRDT = {
    largestIDs: { [site: string]: number },
    roots: Array<string>,
    map: { [key: string]: Node },
};
```

`map` stores all nodes by key, where a key is the string form of an ID: `${number}:${site}`.

`roots` stores top-level node keys in document order.

`largestIDs` stores the largest known numeric ID per site. This is used when generating new IDs.

Each node has this shape:

```ts
type Node = {
    id: [number, string],
    parent: string,
    deleted?: boolean | null,
    size: number,
    children: Array<string>,
    content: Content,
    formats: { [key: string]: Array<string> },
};
```

Important fields:

- `id`: the node's stable CRDT identity.
- `parent`: the key of the node that this node was inserted after, represented structurally as a parent/child relationship.
- `children`: nodes inserted after this node, ordered by ID.
- `deleted`: tombstone marker. Deleted text remains in the structure but does not appear in visible output.
- `size`: cached visible text length of this node's subtree.
- `formats`: cached active format open markers at this node.

There are three content kinds:

```ts
type Content =
    | { type: 'text', text: string }
    | { type: 'open', key: string, value: any, stamp: string }
    | { type: 'close', key: string, stamp: string };
```

Text nodes may contain multiple contiguous characters from the same site. The merge code can split them back into per-character atoms when needed.

## IDs and Ordering

Every content node has an ID `[number, site]`.

The numeric part increases per site. A text node with text length `n` occupies the ID range:

```text
[id, site] through [id + n - 1, site]
```

For example, a text node with ID `[4, "a"]` and text `"hey"` represents characters:

```text
4:a -> h
5:a -> e
6:a -> y
```

IDs are compared by numeric ID first, then by site string:

```text
[1, "a"] < [2, "a"]
[1, "a"] < [1, "b"]
```

When multiple nodes are inserted after the same predecessor, siblings are sorted in descending ID order by `insertionPos`/`collectNodes`. This tie-break is what makes concurrent inserts at the same position deterministic.

## The Tree Model

The tree is an ordered representation of an "insert after" graph.

If node B was inserted after node A, B becomes either:

- a child of A, when inserted directly after A, or
- a sibling in A's child list when competing with other insertions at the same position.

Walking the document is depth-first:

1. Visit a root node.
2. Visit that node's content.
3. Visit its children in order.
4. Move to following siblings and roots.

This gives the same effect as an RGA-style sequence CRDT: every insertion says "place this new content after this existing ID"; concurrent insertions after the same ID are sorted by a deterministic ID order.

## Locations and Positions

User-facing edits use visible character offsets. The CRDT itself uses logical locations.

A `Loc` is:

```ts
type Loc = { id: number, site: string, pre: boolean };
```

`pre` indicates which side of a visible position the location is anchored to:

- `pre: true`: the location is the character to the left of the position.
- `pre: false`: the location is the character to the right of the position.

The helpers in `loc.ts` translate between visible positions and CRDT locations:

- `posToLoc(state, pos, true)` finds the left anchor for an insertion or range end.
- `posToLoc(state, pos, false)` finds the right anchor for selection starts.
- `locToPos` maps a CRDT location back into visible character space.

The root sentinel IDs are:

```text
0:-root-  start of document
1:-root-  end of document
```

These sentinels let inserts at the beginning or end refer to stable logical positions.

## Insert Generation

The public `insert(state, site, at, text, newFormat?)` helper creates one or more deltas.

Steps:

1. Convert visible position `at` to a left-anchored CRDT location.
2. If `newFormat` is provided, call `adjustForFormat` to prefer a nearby insertion point with matching active formatting.
3. Find the largest relevant local ID from:
   - the anchor location,
   - the node after the anchor,
   - `largestIDs[site]`.
4. Allocate the next numeric ID for the new content.
5. If formatting needs to change for the inserted text, emit format marker deltas first.
6. Emit the final text insert delta:

```ts
{
    type: 'insert',
    after: [anchorId, anchorSite],
    id: [nextId, site],
    text,
}
```

If the inserted text should have formats different from the current insertion point, the helper creates open/close format markers and inserts the text inside those markers.

## Applying Inserts

`apply` handles insert deltas through `insertNode`.

The core steps are:

1. Ignore duplicate-looking inserts when the ID is at or below `largestIDs[site]`.
2. Update `largestIDs` for the inserted site.
3. Find the parent position for the `after` ID.
4. Split existing text nodes if the insertion lands in the middle of a text node.
5. Insert the new node into the appropriate root list or child list.
6. Sort competing children by ID.
7. Copy active formats from the previous visible position.
8. Update cached subtree sizes.

Text node splitting is important. Since text nodes can store runs of characters, inserting or deleting at a character inside the run first splits the run so the operation can refer to an exact ID boundary.

Adjacent text from the same site can be merged as an optimization when:

- both nodes are text,
- both are not deleted,
- IDs are contiguous,
- and no child ordering would be disturbed.

## Delete Generation

The public `del(state, at, length)` helper converts a visible range into CRDT spans:

```ts
type Span = { id: number, site: string, length: number };
```

`selectionToSpans` walks visible text from `at` to `at + length`, skipping deleted text and format markers. It returns spans in logical ID space.

For example, if visible text was built from interleaved insertions, one visible deletion may become several spans:

```text
visible range: positions 1..4
spans:
  { id: 2, site: "a", length: 1 }
  { id: 9, site: "b", length: 1 }
  { id: 3, site: "a", length: 1 }
```

The generated delta is:

```ts
{ type: 'delete', spans }
```

## Applying Deletes

`apply` handles delete deltas by calling `deleteSpan` for every span.

For each span:

1. If the span is already fully deleted, do nothing.
2. Ensure there is a node boundary at the start ID, splitting a text node if necessary.
3. If the span ends inside a text node, split at the end boundary too.
4. Mark the covered text node as `deleted`.
5. Subtract its visible length from ancestor `size` caches.
6. Merge adjacent compatible text nodes where possible.

Deletes only tombstone text. They do not generally remove format markers, although format-specific deletion exists for selected unformatting cases.

## Formatting Model

Formatting is represented as marker nodes in the same sequence as text.

Formatting `"ell"` as bold in `"Hello"` creates a stream like:

```text
H <open bold=true stamp=s> ell <close bold stamp=s> o
```

The format open marker stores:

```ts
{
    type: 'open',
    key: 'bold',
    value: true,
    stamp: 's',
}
```

The close marker stores:

```ts
{
    type: 'close',
    key: 'bold',
    stamp: 's',
}
```

The `stamp` pairs opens with closes and also defines precedence.

## Format Precedence

For each format key, the active format stack is sorted by stamp. The implementation inserts newer/higher-priority stamps ahead of lower-priority stamps using `fmtIdx`.

The effective value for a format key is the value from the first open marker in that key's active list:

```ts
format[key] = state.map[node.formats[key][0]].content.value
```

This lets formats override one another. For example, a large `bold=true` range can contain a smaller `bold=false` range. Inside the smaller range, the higher-priority false marker wins.

## Applying Format Deltas

A format delta contains one open marker and one close marker:

```ts
{
    type: 'format',
    open: { id, after },
    close: { id, after },
    key,
    value,
    stamp,
}
```

Applying it:

1. Inserts the open marker after `open.after`.
2. Inserts the close marker after `close.after`.
3. Walks from the open marker until the close marker.
4. Adds the open marker key to each traversed node's `formats` cache.
5. Keeps each format list sorted by stamp precedence.

Format markers have zero visible size, so they affect styling but not character positions.

## Removing Formatting

Formatting can be removed in two ways.

First, if the selected range exactly covers existing format marker pairs in a structurally clean way, `format(..., value: null)` may generate `delete-format` deltas. A `delete-format` delta tombstones both the open and close marker for a stamp and removes that open marker from affected `formats` caches.

Second, if the package cannot safely delete existing markers, it creates a new format range with `value: null`. This null-valued marker acts as an override. Since it has stamp precedence, it can make a format effectively absent over a range even though older format markers still exist underneath.

Serialization to Quill filters falsy format values out, so null overlays disappear from the visible attributes while still participating in internal precedence.

## Format Caches

Every node has a `formats` cache. It maps format keys to active open marker IDs:

```ts
{
    bold: ["10:a", "4:b"],
    italic: ["7:a"]
}
```

The first marker for a key is the effective value.

The cache is maintained in two ways:

- Incrementally during `apply(format)` and `apply(delete-format)`.
- From scratch during `merge`, by walking the rebuilt tree.

`checkConsistency` recomputes the active format state while walking the tree and checks that each node's cache matches.

## Merging States

`merge(one, two)` rebuilds a canonical state from both inputs.

The algorithm:

1. Compute merged `largestIDs` by taking the per-site maximum.
2. Walk every node in both states.
3. Break text nodes into character atoms.
4. Keep format markers as single atoms.
5. Record each atom by its ID.
6. Record an `after` relationship for each atom.
7. If the same atom appears in both states and either copy is deleted, mark the merged atom deleted.
8. Rebuild a tree starting from the root sentinel.
9. Sort children after the same predecessor by deterministic ID order.
10. Coalesce adjacent compatible text atoms back into text runs.
11. Recompute `size` and `formats` caches.

The atomization step makes merge robust to different local text chunking. One replica may store `"hello"` as one text node while another stores it as several split nodes. Merge reduces both to character atoms, unions them, then creates a canonical tree.

## Why Merge Converges in Principle

The intended convergence argument is:

- Every insertion has a globally unique ID.
- Every atom records the stable ID it was inserted after.
- Merge is a union of atoms by ID.
- Deletion is monotonic: once any replica marks an atom deleted, merged state keeps it deleted.
- Sibling order is deterministic from IDs.
- Format caches are derived from marker order, not independently chosen.

If all replicas eventually see the same atoms and tombstones, rebuilding from the same atom set should produce the same visible text and format runs.

This convergence argument depends on valid deltas: IDs must be unique per inserted content, predecessor references must be meaningful, and duplicate IDs must not carry conflicting content.

## Serialization

Plain text serialization walks the tree and concatenates non-deleted text.

Rich-text serialization walks the tree with current format state. Adjacent text with equal effective attributes can be combined into larger runs.

The Quill adapter exposes:

- `stateToQuillContents(state)`: converts CRDT state to Quill `ops`.
- `quillDeltasToDeltas(state, site, ops, genStamp)`: converts Quill operations into CRDT deltas and applies them to a working state.
- `deltasToQuillDeltas(state, deltas)`: converts CRDT deltas back into Quill patches for a given starting state.

The supported Quill subset is mainly string inserts, retains with attributes, and deletes.

## Invariants

The algorithm relies on these invariants:

- Node IDs are unique.
- Text node ID ranges do not overlap for a site.
- Child lists are sorted deterministically.
- Every child points to its parent and every parent contains its children.
- `size` equals visible text length of the node's subtree.
- Deleted text contributes zero visible size.
- Format open/close markers are paired by stamp.
- A node's `formats` cache equals the active marker stack at that point in document order.
- `largestIDs[site]` is at least the largest known ID for that site.

`checkConsistency` currently verifies cached sizes and format caches. It does not verify every structural or remote-operation invariant.

## Weaknesses, Bugs, and Risks

This section lists risks in the current implementation. Some are correctness bugs; others are missing contracts that make the algorithm hard to trust under real collaboration.

### Duplicate and Conflicting Operations

`insertNode` treats any insert with an ID at or below `largestIDs[site]` as already seen and returns without checking it. That makes valid replay idempotent, but it also means a conflicting remote insert with the same ID and different content or a different `after` location can be silently ignored.

The commented-out validation in `insertNode` suggests this was known unfinished work. For a CRDT, duplicate delivery should be idempotent, but conflicting identity reuse should be detected. Silent acceptance can hide data corruption and make replicas diverge in ways that are difficult to diagnose.

### Consistency Failures Are Swallowed

`apply` runs `checkConsistency` after applying a delta, but catches any error, logs details, and still returns the new state. This is dangerous because callers and tests can continue using a state that the package knows is inconsistent.

For production or serious testing, consistency failures should either throw or be returned as explicit errors. A "best effort" mode could exist separately, but it should not be the default path used by correctness tests.

### Merge Laws Are Not Proven by Tests

The merge algorithm is designed to converge by atomizing both states and rebuilding from a union of atoms. That is plausible, but the current tests do not systematically verify CRDT laws:

- `merge(a, b) == merge(b, a)`
- `merge(merge(a, b), c) == merge(a, merge(b, c))`
- `merge(a, a)` is stable
- all replicas converge after receiving the same operations in different orders

Without those tests, regressions in ordering, tombstone handling, format cache recomputation, or text coalescing can slip through.

### Causal and Delivery Assumptions Are Unclear

The code does not clearly define whether deltas can be delivered out of causal order. Many operations refer to existing IDs through `after`, spans, open markers, or close markers. If a delete or format arrives before the insertion it references, behavior is not specified as part of the API contract.

The package should decide whether it requires causal delivery, buffers missing dependencies, or rejects operations with unknown references.

### Formatting Semantics Are Fragile

Formatting uses open/close marker nodes plus stamp-based precedence. This is compact, but several correctness questions remain:

- Stamps are caller-provided strings, so total ordering and collision avoidance are outside the CRDT.
- Null-valued formats are used as overrides when marker deletion is not possible.
- Some unformat operations physically tombstone marker pairs, while others add null overlays.
- Concurrent format, unformat, and delete operations over overlapping ranges are not heavily tested.

These semantics may be reasonable, but they need a formal contract and generated tests. Otherwise the same visible edit can produce different internal structures whose future behavior is hard to predict.

### Format Caches Are Derived but Mutated Incrementally

Each node stores a `formats` cache that is logically derived from walking the marker stream. During normal `apply`, this cache is updated incrementally. During `merge`, it is recomputed from scratch.

That split creates risk: incremental updates and full recomputation must always agree. The current fixture tests check some cases, but not enough overlapping/concurrent format cases to make this robust.

### Structural Validation Is Incomplete

`checkConsistency` validates cached sizes and format caches, but it does not validate the full tree structure. Missing checks include:

- parent/child backreferences,
- cycles,
- duplicate node IDs,
- overlapping text ID ranges,
- child ordering,
- `largestIDs` matching actual known IDs,
- malformed open/close marker pairs.

Those gaps matter because many helper functions assume the structure is valid.

### Snapshot Immutability Is Unclear

`apply` shallow-clones the CRDT and its `map`, then performs local mutations while splitting nodes, updating children, and changing caches. Many touched nodes are replaced, but the package does not have tests proving that previous states remain unchanged.

If callers treat CRDT states as immutable values, this needs explicit guarantees and tests.

### Text Chunking Is an Optimization With Edge Cases

The implementation stores contiguous text from the same site as multi-character nodes, then splits nodes when operations need finer boundaries. Merge atomizes text back into characters and may coalesce compatible atoms again.

This optimization is sensible, but it increases the surface area for bugs:

- split boundaries must preserve children and parents,
- delete spans must split both start and end boundaries correctly,
- size caches must update through ancestors,
- merge must produce equivalent output regardless of prior chunking.

Property tests should specifically compare states with different chunking but the same atom set.

### Navigation Helper Risk

`prevSibling` appears to return `parent.children[idx + 1]` in the non-root case where `idx - 1` would be expected. It is not currently used in the main formatting path, but if it becomes active later, it could cause incorrect traversal.

### Block Rich Text Is Not Fully Modeled

The algorithm can represent Quill-style newline attributes as formatting over newline characters, but it does not fully model structural block operations such as splitting, joining, nesting, list-item behavior, or block-level conflict resolution.

This is a feature risk if the package is expected to support rich text beyond inline attributes and simple newline formatting.

### Performance Is Unknown

Full-state `merge` atomizes text into per-character atoms. This is simple and helps canonicalize different chunking, but it may be expensive for large documents. There are no benchmarks or complexity targets.

Potential pressure points:

- full tree walks for merge and serialization,
- per-character atom maps during merge,
- repeated splitting and ancestor size updates,
- format cache updates across large ranges.

## Known Limitations in the Current Implementation

Some details are important when reasoning about this implementation:

- Duplicate insert validation is currently disabled. `insertNode` skips inserts whose ID is at or below `largestIDs[site]` without checking that the duplicate has the same content and predecessor.
- `apply` catches consistency errors, logs them, and still returns the state.
- Merge is designed around full-state merging. Out-of-order delta delivery is not clearly specified.
- Format stamps are caller-controlled strings. Correct precedence depends on callers generating stamps with the intended total order.
- Format deletion is partial. Some unformat operations tombstone existing marker pairs; others create null-valued override ranges.
- Block-level rich-text semantics are not fully modeled. Newline attributes can represent some Quill block formats, but structural block split/join behavior is unresolved.
- Quill support is a subset, not a complete Quill document model.
