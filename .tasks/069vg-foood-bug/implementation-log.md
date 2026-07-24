# Implementation log

## Phase 1: pre-client detection and reset

Status: complete.

Implemented:

- Added Foood-specific IndexedDB existence and deletion helpers in
  `examples/foood/src/recoverPersistence.js`.
- Detects a persisted replica clock paired with a missing public or private
  database.
- Resets both replicas, preserves authentication, and reloads before React creates
  either client.
- Uses `IDBFactory.databases()` when available and an open/abort fallback for
  older browsers.
- Handles blocked deletion, fails open on unexpected storage API errors, and
  guards against reload loops.
- Centralized production/local prefix selection and made the Foood bootstrap
  asynchronous.

Issue encountered:

- Parcel 1 attempted to auto-install a missing transform dependency while
  building `packages/rich-text-crdt/dist`. It added Babel 8 to that package,
  which Parcel 1 then failed to load as CommonJS. The generated manifest/lockfile
  changes are not part of this implementation. Final verification will disable
  Parcel auto-install and use the repository's existing Babel 7 installation.

## Phase 2: one-time recovery for already-empty databases

Status: complete.

Implemented:

- Added a versioned, one-time check of the existing `recipes:nodes` store.
- Treats a missing recipe object store as empty/corrupt.
- Reuses the same guarded reset path for an already-recreated empty database.
- Persists the one-time marker outside the replica clock/database keys so a
  legitimately empty account is reset at most once.
- Logs whether recovery was triggered by a missing database or the one-time
  empty-database check.

Tradeoff:

- A genuinely empty account that predates this release may be reset once. Auth is
  preserved, the server resync remains empty, and the versioned marker prevents
  repeated resets.

## Phase 3: verification

Status: complete with environment limitations.

Passed:

- Prettier check passed for all three changed Foood source files.
- Babel parsed and transformed all three changed Flow/React source files from the
  repository root.
- Direct state-machine checks passed for:
  - a first-time client with no clocks or databases;
  - a healthy existing replica;
  - a missing private database;
  - an already-recreated empty public database;
  - preservation of `foood/auth`;
  - removal of both replica clocks;
  - one reload after successful reset; and
  - suppression of a second attempt by the session guard.
- The legacy IndexedDB fallback probe passed for both an existing database and a
  missing database detected through `onupgradeneeded`/`oldVersion === 0`.
- `git diff --check` passed.

Issues and workarounds:

- The Foood production build remains blocked by an existing Parcel 1 dependency
  resolution problem. When Parcel reaches
  `packages/rich-text-crdt/dist/index.js`, it attempts to add `@babel/core` to
  that package even with `--no-autoinstall`. The auto-installer selects Babel 8,
  which Parcel 1 cannot require as CommonJS. Temporary manifest, lockfile, cache,
  and module-resolution artifacts from these attempts were removed/restored.
  The changed files were instead verified with the repository-root Babel 7
  toolchain.
- Flow `focus-check` could not start because its shared-memory heap initialization
  failed with `Out of shared memory`. Babel's Flow transform successfully parsed
  the files, but a full Flow typecheck was not available.
- The in-app browser runtime failed during initialization with
  `Cannot redefine property: process`, so a real-browser pass could not be run.
  Browser storage behavior was exercised through controlled IndexedDB,
  localStorage, sessionStorage, and reload mocks instead.

## Result

Foood now checks persistence before constructing either client. A surviving
clock paired with a missing database triggers a guarded reset of both public and
private replicas while leaving auth intact, followed by one reload. A versioned
one-time empty-store check also repairs clients whose IndexedDB databases had
already been recreated before this fix was deployed.
