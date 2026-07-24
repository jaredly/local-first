# Bugs Found by Black-Box Tests

These bugs were found while adding black-box tests in `packages/rich-text-crdt/black-box.test.ts`. Each scenario starts from an empty document, applies Quill-style deltas through the public conversion helpers, and asserts only on reified Quill contents from `stateToQuillContents`.

The failing tests are currently preserved as skipped specs so the suite can remain green while keeping exact repros close to the code.

## 1. Concurrent Insert Inside a Deleted Range Is Repositioned

Skipped test:

```ts
it.skip('BUG: preserves insert position inside a concurrent delete range', ...)
```

Initial document:

```ts
{ ops: [{ insert: 'abcd' }] }
```

Client A deletes `bc`:

```ts
[{ retain: 1 }, { delete: 2 }]
```

Client B inserts `X` after `b`:

```ts
[{ retain: 2 }, { insert: 'X' }]
```

Expected reified contents:

```ts
{ ops: [{ insert: 'aXd' }] }
```

Observed reified contents:

```ts
{ ops: [{ insert: 'adX' }] }
```

Why this matters:

The inserted `X` was logically inserted inside the range that another client deleted. A reasonable CRDT behavior is to preserve the insertion's anchor relative to the deleted text, so the inserted content appears where that deleted text used to be. Instead, the insertion moves after `d`, changing the user-visible intent.

Hypothesis:

This likely comes from how deleted text affects traversal and insertion-position reconstruction. `deleteSpan` tombstones text and sets deleted node size to zero. Later, `parentForAfter`, `walkFrom`, or visible serialization may place children of deleted nodes after the deleted subtree's next visible sibling. Since deleted nodes are skipped by normal walking unless `all` is passed, children inserted under deleted anchors may be visited later than intended.

Implementation areas to inspect:

- `deleteSpan` and `maybeMergeUp` in `apply.ts`
- `walkLoop` / `walkFrom` skipping deleted nodes in `loc.ts`
- `nodeToString` / `stateToQuillContents` traversal behavior for children of deleted nodes
- merge reconstruction of children attached to deleted atoms

## 2. Overlapping Concurrent Deletes Leave Extra Text Visible

Skipped test:

```ts
it.skip('BUG: applies overlapping concurrent deletes completely', ...)
```

Initial document:

```ts
{ ops: [{ insert: 'abcdef' }] }
```

Client A deletes `bcd`:

```ts
[{ retain: 1 }, { delete: 3 }]
```

Client B deletes `de`:

```ts
[{ retain: 3 }, { delete: 2 }]
```

Expected reified contents:

```ts
{ ops: [{ insert: 'af' }] }
```

Observed reified contents:

```ts
{ ops: [{ insert: 'aef' }] }
```

Why this matters:

Deletes should be monotonic: if any replica deletes a character ID, that character should remain deleted after synchronization. Here, `e` is deleted by Client B but remains visible after exchanging deltas.

Hypothesis:

The delete delta stores spans generated against Client B's local pre-delete structure. When Client A's delete has already split/tombstoned part of the same original text node, applying Client B's span may incorrectly conclude the remaining span is already deleted or may fail to continue over the intended ID range.

`isSpanAllDeleted` is suspicious: it uses `nodeForKey` and `contentLength(parentNode.content)` to recursively decide whether a span is already deleted. If `nodeForKey` returns a deleted node that covers only part of the span, or if split/merge changes the node shape around overlapping spans, the recursion can misclassify part of the requested deletion.

Implementation areas to inspect:

- `selectionToSpans` in `span.ts`
- `isSpanAllDeleted`, `ensureNodeAt`, and `deleteSpan` in `apply.ts`
- text-node split and merge behavior after partial deletes
- whether spans should be applied atom-by-atom for correctness before optimizing

## 3. Concurrent Same-Range Different-Key Formatting Is Lost

Skipped test:

```ts
it.skip('BUG: preserves concurrent same-range different-key formatting', ...)
```

Initial document:

```ts
{ ops: [{ insert: 'abcd' }] }
```

Client A bolds `bc`:

```ts
[{ retain: 1 }, { retain: 2, attributes: { bold: true } }]
```

Client B italicizes `bc`:

```ts
[{ retain: 1 }, { retain: 2, attributes: { italic: true } }]
```

Expected reified contents:

```ts
{
    ops: [
        { insert: 'a' },
        { insert: 'bc', attributes: { bold: true, italic: true } },
        { insert: 'd' },
    ],
}
```

Observed reified contents:

```ts
{ ops: [{ insert: 'abcd' }] }
```

Why this matters:

Independent formatting attributes should compose. Concurrent `bold` and `italic` on the same range should not cancel or erase each other. Losing both attributes means remote formatting deltas are not being applied correctly.

Hypothesis:

The logs during the failing run included messages like `Found a "close" marker, but no open marker`. That suggests remote format marker insertion can create a traversal order where close markers appear without their matching open markers, or where format cache recomputation skips the open marker.

One likely issue is that a `format` delta is represented as two separate marker inserts, each with its own `after`. When applying a remote format delta to a state whose tree has been changed by another concurrent format delta, `insertNode` may place the open and close markers in an order that no longer encloses the intended range. If the close marker sorts before the open marker in traversal order, the effective format is lost.

Implementation areas to inspect:

- `format` delta generation in `deltas.ts`
- `apply(format)` in `apply.ts`
- `insertNode` ordering for zero-width format markers
- `walkFrom` range traversal from open to close
- `checkFormats` and `addFormats` marker-stack behavior

## 4. Overlapping Same-Key Formatting Ignores Null/False Override Range

Skipped test:

```ts
it.skip('BUG: preserves overlapping same-key formatting by deterministic stamp order', ...)
```

Initial document:

```ts
{ ops: [{ insert: 'abcd' }] }
```

Client A applies `bold: true` to `abc`:

```ts
[{ retain: 3, attributes: { bold: true } }]
```

Client B applies `bold: false` to `bcd`:

```ts
[{ retain: 1 }, { retain: 3, attributes: { bold: false } }]
```

Expected reified contents:

```ts
{
    ops: [
        { insert: 'a', attributes: { bold: true } },
        { insert: 'bcd' },
    ],
}
```

Observed reified contents:

```ts
{ ops: [{ insert: 'abcd', attributes: { bold: true } }] }
```

Why this matters:

The package's formatting model relies on stamp-ordered same-key overrides. A later/higher-priority `bold: false` range should override an overlapping `bold: true` range. If false/null overrides do not survive concurrency, users cannot reliably unformat text.

Hypothesis:

This appears related to the marker-ordering issue in Bug 3, but with same-key precedence added. The `bold: false` marker may be inserted in a position where it does not cover `bcd`, or the `formats` cache may retain only the `bold: true` marker as active.

There is also a semantic issue: `stateToQuillContents` filters falsy attribute values out, but internal `formats` still need to carry `bold: false` or `bold: null` as an active override. If a false-valued open marker is lost, sorted behind the true marker, or deleted as if it were absence rather than an override, the visible output becomes fully bold.

Implementation areas to inspect:

- `fmtIdx` and `addFormat` precedence ordering
- false/null values in `getFormatValues` and `stateToQuillContents`
- concurrent insertion order of open/close format markers
- `maybeDeleteFormats` vs null/false overlay behavior

## 5. Independent Concurrent Newline Attributes Are Lost

Skipped test:

```ts
it.skip('BUG: preserves independent concurrent newline attributes', ...)
```

Initial document:

```ts
{ ops: [{ insert: 'Hello\n' }] }
```

Client A applies list formatting to the newline:

```ts
[{ retain: 5 }, { retain: 1, attributes: { list: 'bullet' } }]
```

Client B applies indent formatting to the same newline:

```ts
[{ retain: 5 }, { retain: 1, attributes: { indent: 1 } }]
```

Expected reified contents:

```ts
{
    ops: [
        { insert: 'Hello' },
        { insert: '\n', attributes: { indent: 1, list: 'bullet' } },
    ],
}
```

Observed reified contents:

```ts
{ ops: [{ insert: 'Hello\n' }] }
```

Why this matters:

Quill represents many block-level formats as attributes on newline characters. Losing concurrent newline attributes means collaborative list/header/indent editing will be unreliable.

Hypothesis:

This is probably the same root cause as Bug 3, applied to a one-character newline range. Formatting markers generated around the newline may not survive concurrent marker insertion, may be ordered so their close markers appear before opens, or may fail to update the newline text node's `formats` cache.

There may also be newline-specific boundary sensitivity. Formatting a newline often means the open marker is inserted immediately before the newline and the close marker immediately after it. Concurrent markers around the same zero/one-character boundary stress the insertion tie-break rules for zero-width format nodes.

Implementation areas to inspect:

- marker insertion around single-character ranges
- `posToLoc` and `idAfter` for newline positions
- concurrent zero-width marker ordering in `insertNode`
- `stateToQuillContents` filtering attributes

## Cross-Cutting Notes

The formatting failures all produced or were associated with `Found a "close" marker, but no open marker` logs during the failing run. That points strongly toward an ordering or range-reconstruction issue for concurrent format marker deltas.

The delete failures point toward span application over text nodes that have already been split or tombstoned by another client.

Recommended debugging order:

1. Fix overlapping concurrent delete semantics first. Text deletion is simpler than formatting and tests monotonic tombstone behavior.
2. Inspect remote format marker ordering with a minimal same-range bold/italic repro.
3. Decide whether format deltas should be applied as a pair with range repair/canonicalization rather than two independent marker insertions.
4. Add internal invariant tests only after the black-box expected behavior is agreed.

