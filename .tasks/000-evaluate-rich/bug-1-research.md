# Bug 1 Research: Concurrent Insert Inside a Deleted Range

## Repro

Skipped black-box test:

```ts
it.skip('BUG: preserves insert position inside a concurrent delete range', ...)
```

Initial contents:

```ts
{ ops: [{ insert: 'abcd' }] }
```

Concurrent edits:

```ts
// Client A
[{ retain: 1 }, { delete: 2 }] // delete "bc"

// Client B
[{ retain: 2 }, { insert: 'X' }] // insert after "b"
```

Expected visible contents:

```ts
{ ops: [{ insert: 'aXd' }] }
```

Observed visible contents:

```ts
{ ops: [{ insert: 'adX' }] }
```

## Current Mechanics

The CRDT stores text as nested nodes. A node's own text is emitted before its children, and deleted nodes skip their own text but still traverse children:

- `walkLoop` skips `fn(node)` when `node.deleted`, but always descends into `node.children` in [loc.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/loc.ts:49).
- `stateToQuillContents` serializes through `walkWithFmt`, which uses that same traversal in [debug.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/debug.ts:9) and [quill-deltas.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/quill-deltas.ts:38).
- `deleteSpan` tombstones text and decrements visible size, but keeps the tree shape and children in [apply.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/apply.ts:256).

When an insertion lands inside an existing text node, `parentForAfter` splits the text node after the anchor character and returns the left split as the parent in [apply.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/apply.ts:83). The suffix becomes a child of the left split in `split` in [apply.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/apply.ts:27).

That representation is the important part: after splitting `abcd` at the insertion point after `b`, the original suffix `cd` is represented as a child of `ab` or `b`, and the new insert `X` is also represented as a child of that same parent.

Children are ordered only by `insertionPos`, which compares IDs in [apply.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/apply.ts:106). Merge reconstruction has the same shape: `merge` atomizes both states and sorts all children of an `after` key by ID in [merge.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/merge.ts:142).

## Likely Root Cause

The suffix created by splitting an existing text node is not semantically just another concurrent insert. It is the original right boundary of the insertion position.

For the bug, after deleting `bc`, the tree around the deleted range can become conceptually:

```txt
a
  b (deleted)
    c (deleted)
      d
    X
```

or equivalently, after a split while applying the remote insert:

```txt
a
  b (deleted)
    c... (deleted suffix / original continuation)
    X
```

Traversal emits the deleted parent `b`'s children in child order. If the original continuation child `c` sorts before `X`, traversal descends through deleted `c` to visible `d`, then emits `X`, producing `adX`.

This can happen because IDs are compared lexicographically by `[number, site]`. In the initial insert, original characters may have IDs like:

```txt
a = 1:base
b = 2:base
c = 3:base
d = 4:base
```

The concurrent insert after `b` may get:

```txt
X = 3:b
```

Both `c` and `X` are now children "after b" in the split tree, but `keyCmp([3, "base"], [3, "b"])` puts the original continuation `c` ahead of `X`. That makes the suffix win the sibling ordering even though the user operation was an insertion between `b` and `c`.

So the issue is not mainly that deleted nodes are skipped. Deleted-node traversal is doing the useful thing by still visiting children. The issue is that split suffixes and inserted siblings share one child list with one generic ID sort, losing the distinction between:

- the original continuation of a text run, and
- insertions anchored at the boundary before that continuation.

## Fix Direction

Add a deterministic child ordering rule that treats same-site contiguous text continuation as the right boundary, not as a normal competing insertion.

For a parent text node ending at ID `after`, a child is the original continuation when:

```ts
child.content.type === 'text' &&
child.id[1] === after[1] &&
child.id[0] === after[0] + 1
```

When ordering children under that parent/after key:

1. Sort non-continuation inserted children with the existing deterministic ID order.
2. Place the continuation child after those inserted children.
3. Keep recursing into the continuation after inserted children have been emitted.

This makes an insert after `b` serialize before the suffix starting at `c`, even when `c`'s ID sorts ahead of the insert's ID.

Likely places to implement:

- Replace or wrap `insertionPos` for text-node children in `insertNode`.
- Make `locToInsertionPos` use the same child ordering when converting CRDT insertions back to Quill positions.
- Update `merge.collectNodes` so atomized reconstruction uses the same ordering rule. Otherwise direct `merge(a, b)` can still rebuild `c` before `X` even if incremental `apply` is fixed.

## Risks and Edge Cases

This should be scoped carefully because child order is a core convergence rule.

The rule must be deterministic from node IDs and content only. It cannot depend on local application order. Computing "continuation child" from parent last ID and child ID is deterministic and already implied by text-node split/merge logic.

The rule should only demote the direct same-site contiguous continuation. Other children with the same `after` should keep the current ID ordering so concurrent inserts at the same position still converge.

Be careful with local same-site typing. The append fast path in `insertNode` merges contiguous text into the parent when possible in [apply.ts](/Users/jared/clone/exploration/local-first/packages/rich-text-crdt/apply.ts:172). The continuation-order rule should not block that optimization; it should only affect ordering among existing children when a suffix already exists.

Deleted continuations matter. The bug specifically needs the rule even when the continuation child is deleted, because that deleted child may contain visible descendants like `d`.

## Test Plan

First unskip or duplicate the black-box test for bug 1:

```ts
it('preserves insert position inside a concurrent delete range', ...)
```

Add a lower-level traversal/order test for the exact shape:

```txt
parent: deleted "b"
children: X and deleted continuation "c" with visible child "d"
expected traversal: X before d
```

Also add a merge-specific test that constructs the two clients independently and asserts both:

```ts
stateToQuillContents(merge(a.state, b.state))
stateToQuillContents(merge(b.state, a.state))
```

That matters because `merge.collectNodes` currently has its own child ordering path.

## Recommendation

Fix the ordering primitive rather than special-casing serialization. Serialization is reflecting the tree order consistently; the wrong order enters earlier when a split suffix and inserted child are treated as peer insertions.

The most promising implementation is a shared helper along these lines:

```ts
const isContinuationChild = (parent: Node, child: Node) =>
    parent.content.type === 'text' &&
    child.content.type === 'text' &&
    child.id[1] === parent.id[1] &&
    child.id[0] === parent.id[0] + parent.content.text.length;
```

Use that helper anywhere children under a text node are ordered. Non-continuations should keep the current `keyCmp` order; the continuation should come after them. Then run the black-box suite and the existing merge tests, because this touches both incremental application and merge reconstruction.
