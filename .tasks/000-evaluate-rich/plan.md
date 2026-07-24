# Plan: Rigorous Black-Box Test Suite

## Goal

Build a rigorous test suite for `packages/rich-text-crdt` that treats the package as a black box.

The tests should:

- start from an empty document,
- apply edits through Quill-style deltas,
- optionally simulate multiple clients,
- synchronize clients by exchanging CRDT deltas and/or merging states,
- reify the final CRDT state back to Quill contents,
- assert only on the resulting Quill contents.

The first phase should avoid assertions about internal tree shape, node IDs, cached sizes, format marker placement, or tombstones. Those are implementation details. The contract under test is: given a sequence of user-visible rich-text edits, all clients converge to the expected visible Quill document.

## Test Harness Shape

Create a black-box test helper around the existing public API:

```ts
type Client = {
    site: string;
    state: CRDT;
    outbox: Array<Delta>;
};
```

Core helpers:

- `makeClient(site): Client`
- `applyQuill(client, ops): Array<Delta>`
- `deliver(from, to, deltas)`
- `deliverAll(clients)`
- `mergeClients(a, b)`
- `contents(client): QuillContents`
- `expectAllContents(clients, expected)`

`applyQuill` should call `quillDeltasToDeltas(client.state, client.site, ops, genStamp)` and update the client's state using the returned state. It should append returned CRDT deltas to that client's outbox.

`contents` should call `stateToQuillContents(client.state)`.

Use deterministic stamp generation in tests. A simple per-client counter is enough:

```ts
const genStamp = () => `${site}:${counter++}`;
```

If stamp lexical ordering matters, make that explicit in the helper so tests are stable.

## Document Initialization

Decide whether black-box tests start from:

1. `init()` as a truly empty document, or
2. `init()` plus the package's Quill newline initialization delta.

Quill documents normally end with a newline. The current package has an `initialQuillDelta` constant but does not appear to apply it automatically. The test suite should pick one convention and use it consistently.

Recommended first convention:

- Start with `init()`.
- Use explicit Quill inserts, including `"\n"` when the test needs Quill-like block behavior.
- Expected contents should match `stateToQuillContents` output exactly.

Add a short note in the test helper documenting this.

## Phase 1: Single-Client Black-Box Tests

These tests establish the basic visible behavior before adding collaboration.

### Plain Text

Cases:

- insert text into empty document,
- insert at start,
- insert at middle,
- insert at end,
- delete at start,
- delete in middle,
- delete at end,
- delete across text inserted in multiple prior operations,
- replace text as delete plus insert,
- no-op retain-only delta.

Example:

```ts
runSingleClient([
    [{ insert: "Hello" }],
    [{ retain: 5 }, { insert: " world" }],
    [{ retain: 5 }, { delete: 1 }],
], {
    ops: [{ insert: "Helloworld" }],
});
```

### Inline Formatting

Cases:

- bold a range,
- italic a range,
- apply two independent attributes to the same range,
- apply overlapping attributes,
- remove an attribute with `{ bold: null }`,
- format text inserted later inside an existing format boundary,
- insert text with attributes,
- delete text from inside a formatted range,
- delete across format boundaries.

Expected contents should use Quill-style adjacent op coalescing:

```ts
{
    ops: [
        { insert: "H" },
        { insert: "ell", attributes: { bold: true } },
        { insert: "o" },
    ],
}
```

### Block-Like Newline Attributes

Cases:

- insert `Hello\n`,
- apply `{ header: 1 }` to newline,
- apply `{ list: "bullet" }` to newline,
- split a list item by inserting `"\n"` with list attributes,
- indent a list newline,
- delete text before a formatted newline,
- delete a formatted newline.

Keep these tests narrow. The current algorithm does not fully model block structure, so these should document supported visible behavior rather than assume full Quill semantics.

## Phase 2: Two-Client Convergence Tests

Each test starts from a shared state, forks two clients, applies local Quill deltas independently, exchanges CRDT deltas in both orders, and expects both clients to have the same Quill contents.

For each case, test at least:

- deliver A then B,
- deliver B then A,
- duplicate delivery of A's deltas,
- duplicate delivery of B's deltas.

### Concurrent Plain Text

Cases:

- both clients insert at empty document start,
- both clients insert at same middle position,
- one inserts at start while one inserts at end,
- one deletes a range while one inserts before it,
- one deletes a range while one inserts inside it,
- both delete overlapping ranges,
- both delete the same range.

For cases with deterministic but non-obvious ordering, write expected output based on the algorithm's public ordering behavior and lock it down.

Example shape:

```ts
runConcurrent({
    initial: [[{ insert: "ac" }]],
    a: [[{ retain: 1 }, { insert: "b" }]],
    b: [[{ retain: 1 }, { insert: "B" }]],
    expected: {
        ops: [{ insert: "..." }],
    },
});
```

### Concurrent Formatting

Cases:

- both clients bold the same range,
- one bolds while one italics the same range,
- overlapping bold ranges,
- one removes bold while one adds bold over a larger range,
- one formats a range while one deletes part of it,
- one inserts formatted text while one formats surrounding text,
- one edits inside a formatted range while another removes the format.

For expected results, prefer small documents where the correct visible Quill output can be reasoned about directly.

### Concurrent Newline Attributes

Cases:

- both clients apply the same list attribute to a newline,
- one applies list while one applies indent,
- one inserts a new newline while one formats the existing newline,
- one deletes a newline while one formats it.

These may reveal unsupported semantics. If a behavior is not desired, capture it in a skipped or `todo` test with the expected future behavior.

## Phase 3: Multi-Client Convergence Matrix

Add three-client tests to exercise associativity-like behavior through black-box outputs.

Test pattern:

1. Start clients A, B, C from the same document.
2. Apply distinct local Quill edits on each.
3. Deliver deltas in several permutations:
   - A -> B -> C,
   - C -> B -> A,
   - pairwise mesh,
   - duplicate deliveries mixed in.
4. Assert all final Quill contents equal the expected document.

Cases:

- three concurrent inserts at the same position,
- insert/delete/format overlap,
- three overlapping formats with different keys,
- same key with different values and deterministic stamp order.

## Phase 4: Merge-Based Black-Box Tests

In addition to delta delivery, test full-state merge as a black box.

For each selected two-client and three-client case:

- compute `merge(a.state, b.state)`,
- compute `merge(b.state, a.state)`,
- compare both `stateToQuillContents` results to expected,
- for three clients, compare both association orders:
  - `merge(merge(a, b), c)`,
  - `merge(a, merge(b, c))`.

Assertions should still only use reified Quill contents.

This phase gives coverage of the merge CRDT laws without asserting on internal canonical tree structure.

## Phase 5: Generated Black-Box Tests

Once curated tests are stable, add generated tests that still assert only on Quill contents.

### Plain Text Model

Use a simple string model as the oracle.

Generate valid Quill delta sequences containing:

- string inserts,
- retains,
- deletes.

Apply the same logical edits to:

- a JavaScript string model,
- the CRDT through `quillDeltasToDeltas`.

Assert `stateToQuillContents(state)` equals `{ ops: [{ insert: modelString }] }`, with empty-op handling normalized.

### Formatting Model

Start with a deliberately small formatting model:

- attributes: `bold`, `italic`,
- values: `true` and `null`,
- operations over valid visible ranges.

The model can store per-character attributes and apply Quill-like range updates. Compare the CRDT's reified Quill contents to runs produced by the model.

Do this only after the curated formatting tests define the intended semantics around overlapping same-key formats.

### Multi-Client Generated Tests

Generate local operations for two clients from the same base document. Then:

- apply local edits to each client,
- deliver all deltas in random order,
- assert both clients converge to the same Quill contents.

At first, assert convergence only, not a model-expected final value. Then add model expectations for subsets where the model is clear.

Always log/replay the seed on failure.

## Expected Output Normalization

Before comparing Quill contents, normalize outputs:

- merge adjacent ops with identical attributes,
- omit empty `attributes`,
- omit falsy attributes if matching `stateToQuillContents` behavior,
- remove zero-length inserts if any are produced.

Be careful not to over-normalize. The goal is to ignore harmless representation differences, not hide semantic differences.

## Test File Organization

Suggested files:

- `black-box.test.ts`: high-level helpers and basic single-client tests, or shared helpers plus imports.
- `black-box-single.test.ts`: single-client edit behavior.
- `black-box-concurrent.test.ts`: two-client delta-delivery convergence.
- `black-box-merge.test.ts`: full-state merge convergence.
- `black-box-generated.test.ts`: generated/property tests.

If setup overhead is small, start with one `black-box.test.ts` and split when it gets hard to scan.

## Initial Curated Test List

Start with this minimum suite:

1. single-client insert/delete plain text,
2. single-client overlapping inline formats,
3. single-client unformat with `null`,
4. single-client list newline scenario matching existing fixture behavior,
5. two clients insert at empty document start,
6. two clients insert at same middle position,
7. two clients insert/delete overlap,
8. two clients same-range different-key formatting,
9. two clients overlapping same-key formatting with deterministic stamps,
10. two clients format/delete overlap,
11. merge commutativity for concurrent insert,
12. merge associativity for three concurrent inserts.

That gives useful coverage quickly while keeping every assertion at the Quill-content boundary.

## Open Decisions

- Should tests include the implicit final Quill newline, or only explicit newlines?
- Should delta delivery be required to be causal?
- Should duplicate delivery be part of the supported black-box contract?
- What should happen when two clients apply same-key formats with stamps that sort in different orders from wall-clock order?
- Should unsupported Quill features throw, be ignored, or be represented in a lossy way?
- Should black-box expected output include exact op segmentation, or should tests compare normalized runs only?

