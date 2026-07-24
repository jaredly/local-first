# Implementation Log

## 2026-05-29

- Started implementation of the black-box QuillContents test plan.
- Phase 1 target: add a reusable black-box harness and single-client tests that apply Quill deltas from an empty `init()` state and assert only on `stateToQuillContents`.
- Added `packages/rich-text-crdt/black-box.test.ts` with a black-box client harness and Phase 1 single-client coverage for plain text, inline formatting, unformatting, formatted inserts/deletes, and explicit newline attributes.
- First test run found one incorrect expected value in the new delete test; corrected the expected visible text from `235` to `237`.
- Phase 1 passes.
- Added Phase 2 two-client convergence tests. Active passing coverage includes concurrent inserts at the document start, concurrent inserts at the same middle position, and formatting over a concurrent delete.
- Phase 2 exposed five black-box bug scenarios, preserved as skipped tests:
  - insertion inside a concurrently deleted range reifies as `adX` instead of the expected `aXd`,
  - overlapping concurrent deletes leave `e` visible in the `abcdef` case,
  - concurrent same-range different-key formatting reifies as plain text,
  - overlapping same-key formatting reifies as fully bold rather than respecting the higher-priority false range,
  - independent concurrent newline attributes reify as plain newline text.
- Added Phase 3 three-client convergence helpers and active tests for concurrent inserts at document start plus independent inserts at different positions.
- Added Phase 4 merge black-box tests for two-client merge commutativity and three-client merge associativity using reified Quill contents only.
- Verification:
  - `pnpm test -- black-box.test.ts`: passed, 18 active tests and 5 skipped bug repros.
  - `pnpm test`: passed, 47 active tests and 5 skipped bug repros across 4 suites.
  - `pnpm run build`: passed. The shell printed `Error connecting to agent: Operation not permitted` before the package script, but `tsc -p tsconfig.json` completed with exit code 0.
