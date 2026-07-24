# Evaluation: `packages/rich-text-crdt`

## Scope

This package implements a small rich-text CRDT with text insert/delete, inline format markers, Quill delta conversion helpers, selection/location helpers, and a merge operation. I reviewed the public API, implementation, current tests, and local build/test status.

Local verification:

- `pnpm test` in `packages/rich-text-crdt`: 3 suites, 29 tests passed.
- `pnpm run build` in `packages/rich-text-crdt`: TypeScript build completed successfully. The shell printed `Error connecting to agent: Operation not permitted` before the package script, but `tsc -p tsconfig.json` completed with exit code 0.

## API Assessment

The exported surface is broad and mostly internal-shaped:

- `index.ts` exports `init` plus everything from `merge`, `deltas`, `apply`, `loc`, `utils`, and `types`.
- Public callers can construct and apply raw `Delta` objects directly.
- The public state shape exposes implementation details: `largestIDs`, `roots`, and `map`.
- IDs are `[number, string]`, with site IDs supplied by the caller.
- Formatting uses open/close marker nodes and stamps. Effective format precedence is stamp-ordered.

This API is useful for experimentation, but not yet a stable product API. It exposes too many invariants that callers can accidentally violate. A safer public API would distinguish:

- Stable editor operations: `insert`, `delete`, `format`, `apply`, `merge`, serialize/deserialize.
- Internal debug/traversal helpers: `walk`, `posToLoc`, `nodeForKey`, `checkConsistency`, etc.
- Integration adapters: Quill delta conversion, input binding.

The package also needs clearer operation semantics. Important questions are implicit in comments rather than documented: tie-breaking for concurrent inserts, format precedence, deletion semantics for format markers, how block formats are represented, and what deltas are valid to receive from remote peers.

## Feature Completeness

Implemented or partially implemented:

- Plain text insertion and deletion.
- Concurrent insertion ordering by IDs.
- Deletion as tombstoning text spans.
- Inline formatting using open/close markers.
- Format overwrite/precedence by stamp.
- Some format removal cases using `delete-format`.
- Conversion to and from a subset of Quill deltas.
- Location/selection mapping and adjustment.
- Merge by atomizing both trees and reconstructing a canonical tree.
- Basic consistency checks for cached sizes and format caches.

Not complete or uncertain:

- Block-level rich text is not really modeled beyond treating Quill newlines and newline attributes as text plus attributes. The README is exploratory and explicitly raises unresolved block/list/split/join questions.
- Format removal is partial. The implementation only deletes existing format marker pairs when the selected range exactly satisfies structural conditions; otherwise it emits a null-valued format overlay.
- Quill support is subset-oriented. Embeds, non-string inserts, complex attributes, retain/delete composition, and full round-tripping are not covered.
- `text-binding.ts` only contains text-diff inference helpers; there is no complete binding.
- There is no persistence/schema versioning story.
- There is no explicit support for undo/redo, operation causality metadata, conflict diagnostics, or validation of untrusted remote deltas.
- The API does not separate canonical serialization from implementation caches.

## Correctness Assessment

The design has a reasonable CRDT core idea: IDs are stable logical positions, deletes are tombstones, inserts attach after existing IDs, and `merge` reconstructs from atoms. However, the implementation currently needs more proof and stronger tests before it should be trusted.

Highest-risk issues:

1. Duplicate or conflicting deltas are silently accepted in some cases.

   `insertNode` skips any insert whose ID is `<= largestIDs[site]` without verifying that the existing node has the same content and predecessor. The verification code is present but commented out with a STOPSHIP note. This can hide corrupt or conflicting remote operations instead of rejecting them.

2. `apply` logs consistency failures but still returns the inconsistent state.

   `apply` catches `checkConsistency` errors, logs them, and returns `state` anyway. That makes tests and callers vulnerable to continuing after corruption.

3. The merge path is largely untested against CRDT laws.

   Existing fixture tests simulate a little parallel editing by applying remote deltas into one state, but they do not systematically assert that `merge(a, b)`, `merge(b, a)`, repeated merge, and multi-replica merge all converge.

4. Cached `formats` are semantically critical but derived.

   Format caches are updated incrementally in `apply` and recomputed in `merge`. Tests compare two serialization approaches in the fixture runner, which is useful, but there is no broad generated coverage around overlapping formats, deletes through boundaries, concurrent format additions/removals, or applying operations in many orders.

5. There are likely edge-case bugs in navigation helpers.

   `prevSibling` appears to return `parent.children[idx + 1]` where a previous sibling function would be expected to return `idx - 1`. It is currently imported in `deltas.ts` but not used, so this may be dead code rather than an active bug.

6. Format stamps are caller-controlled and not tied to causal/order metadata.

   Effective formatting depends on lexical stamp order. If two peers generate colliding or non-monotonic stamps, behavior may be surprising. The package needs a documented stamp contract or a safer stamp representation.

7. Format deletion and null-valued format overlays need clearer semantics.

   A format with `value: null` is used as an override when marker deletion is not possible. Serialization to Quill filters falsy values out, but internal format precedence still depends on those null marker nodes. This can be valid, but should be specified and stress-tested.

8. Internal mutation and shallow cloning need scrutiny.

   `apply` shallow-clones the CRDT and map, then mutates some nested node objects/format maps during walking and splitting. Many operations replace touched nodes, but the package should have tests proving previous snapshots are not mutated in observable ways.

## Current Test Coverage

Strengths:

- Good starter fixtures for insertion, deletion, text-node splitting/merging, basic formatting, format precedence, insert-with-format, some Quill newline/list scenarios, and deleting existing format pairs.
- `checkConsistency` validates cached text sizes and `formats` caches after fixture actions.
- Basic idempotence is checked for locally generated single deltas in the fixture runner.
- Position and span helpers have targeted tests.

Gaps:

- No property-based tests.
- No systematic multi-replica tests.
- No direct tests for `merge` algebraic laws.
- No tests for adversarial delta order, duplicate delivery, partial delivery, or replay after merge.
- No tests for conflicting insert deltas with the same ID but different content/after.
- No round-trip tests for `state -> Quill -> CRDT -> Quill`.
- No snapshot immutability tests.
- No fuzzing of position conversion (`posToLoc`, `locToPos`, `selectionToSpans`, `spansToSelections`) across random edits.
- No coverage for malformed remote deltas or validation behavior.

## Recommended Testing Plan

### 1. Define Core Invariants

Add a test helper that checks these after every operation and merge:

- All roots and children reference existing nodes.
- Every non-root node's `parent` points back to a parent whose child list contains it.
- There are no cycles.
- Sibling ordering is deterministic according to the package's ID ordering rule.
- `size` equals visible text length of the subtree.
- `toString(state).length === length(state)`.
- `largestIDs[site]` is at least the largest ID used by that site.
- Text nodes from the same site do not overlap by ID range.
- Deleted text contributes zero visible length but remains addressable by ID.
- `formats` cache equals a recomputation from walking visible and deleted marker nodes according to the package's intended semantics.
- Open/close format marker pairs are either both present and active, or both tombstoned for `delete-format`.

Some of these overlap with `checkConsistency`; the helper should extend it rather than replace it.

### 2. Add CRDT Law Tests

For generated and curated operation histories, assert:

- Idempotence: `merge(a, a) == canonical(a)` and `apply(apply(s, d), d) == apply(s, d)` for valid deltas.
- Commutativity: `merge(a, b) == merge(b, a)`.
- Associativity: `merge(merge(a, b), c) == merge(a, merge(b, c))`.
- Convergence: all replicas that receive the same set of operations in different orders eventually serialize to the same canonical state.
- Delivery equivalence: applying all deltas directly vs. applying local deltas then merging replicas produces the same visible text and format runs.

Use a canonical comparison that either normalizes internal tree chunking or compares `merge(state, init())`-style canonical output, because internal text-node coalescing can vary.

### 3. Build a Small Model Oracle

For plain text, use a simple sequence model:

- Each inserted character gets a unique operation ID.
- Deletes tombstone character IDs.
- Concurrent inserts after the same ID are sorted by the same ID comparator.

Generate operations against both the rich-text CRDT and this model. Compare visible strings after every delivery permutation.

For formatting, start with a reduced model:

- Represent format ranges as open/close markers with the same stamp precedence rule.
- Compare effective text runs, not internal marker placement.
- Generate only one or two attributes at first (`bold`, `italic`) before expanding to arbitrary values.

### 4. Property-Based/Fuzz Tests

Use a generator such as `fast-check` and keep seeds on failure. Suggested phases:

1. Single-replica plain text: random insert/delete, validate text and position helpers.
2. Multi-replica plain text: random local inserts/deletes, shuffled delivery, validate convergence.
3. Inline formatting: random format/unformat ranges with deterministic stamps, compare effective runs.
4. Quill subset: random Quill ops within the supported subset, compare `stateToQuillContents`.
5. Snapshot immutability: retain previous states and assert old visible content/caches do not change after later applies.

### 5. Curated Regression Matrix

Add explicit tests for:

- Concurrent inserts at document start and end from multiple sites.
- Concurrent inserts after the same character with lexicographic site tie-breaks.
- Duplicate delivery before and after `largestIDs` advances.
- Same ID with conflicting content/after should throw or be rejected.
- Delete spans crossing inserted islands from other sites.
- Delete of already deleted text.
- Delete before receiving the insert it references, if out-of-order delivery is meant to be supported. If it is not supported, document and test rejection.
- Concurrent format overlaps with same and different keys.
- Concurrent format and delete over the same range.
- Removing a format while another peer extends or overlaps it.
- Formatting zero-length ranges, if supported.
- Newline/list Quill attributes under concurrent edits.
- Full format marker deletion vs. null overlay fallback.

### 6. Quill Adapter Tests

The adapter should have its own contract tests:

- `quillDeltasToDeltas` should apply the same visible edit as Quill for the supported op subset.
- `deltasToQuillDeltas` should produce patches that transform a Quill document equivalently.
- `stateToQuillContents` should round-trip supported text and attributes.
- Unsupported Quill features should fail explicitly rather than silently degrade.
- Remove or gate debug logging from `deltaToQuillDeltas`.

### 7. Negative and Validation Tests

Decide whether remote deltas are trusted. If not, add a validation layer and tests for:

- Duplicate IDs with different content.
- Duplicate format stamps with incompatible open/close markers.
- Missing `after` references.
- Invalid spans that point into format markers or absent text.
- Close markers without corresponding opens.
- Cyclic parent/child structures after malicious state injection.

At minimum, `apply` should not swallow consistency failures in test/production paths.

## Suggested Implementation Order

1. Make `apply` fail loudly on consistency errors, or add a strict mode used by tests.
2. Restore duplicate-delta validation in `insertNode` and add tests for valid replay vs. conflicting replay.
3. Add a canonical serialization helper for text plus effective format runs.
4. Add deterministic multi-replica law tests for a small curated set.
5. Add property-based plain-text tests.
6. Add property-based format tests.
7. Expand Quill adapter contract tests.
8. Decide and document unsupported features and invalid remote operation behavior.

## Open Questions

- Is this package intended to be a production CRDT engine, a prototype, or an experiment?
- Should remote deltas be valid without causal delivery, or must operations be delivered only after dependencies are present?
- What is the intended public API boundary?
- Should callers ever construct raw `Delta` objects, or should all deltas be produced by package helpers?
- What guarantees are required for snapshot immutability?
- What is the formal contract for site IDs and generated numeric IDs?
- What is the formal contract for format stamps? Are collisions possible? Are stamps wall-clock-ish, Lamport-ish, or caller-defined total-order tokens?
- Should format removal physically tombstone marker pairs when possible, or should null overlays be the only semantic mechanism?
- Are block formats, lists, embeds, and non-text Quill inserts in scope?
- Is Quill the primary integration target, or just one adapter?
- Should deleted format markers still participate in cache recomputation, or should tombstoned markers be ignored consistently everywhere?
- Should `merge` preserve internal node chunking where possible, or is canonical reconstruction always acceptable?
- What are the performance targets for large documents? The current merge atomizes text to characters, which is simple but potentially expensive.
- How should malformed remote deltas be reported: throw, ignore, quarantine, or return a result object with errors?
