# Plan: automatically recover a missing Foood replica

## Goal

Add the smallest app-level recovery path that:

- detects the known bad state before either Foood client starts syncing;
- performs the equivalent of **Teardown client** for both Foood databases;
- preserves authentication;
- reloads once so the clients get new session IDs and fetch full history; and
- does not use an empty recipe list as a permanent health check.

This is a mitigation for the current protocol behavior, not a protocol redesign.
The server-side session filtering can be addressed separately.

## Chosen approach

Run an asynchronous persistence preflight at the start of
`examples/foood/src/index.js`, before rendering `<Top />`.

The primary bad-state signal is:

> A Foood replica clock exists in `localStorage`, but either of the IndexedDB
> databases belonging to that replica no longer exists.

The expected pairs are:

| Mode | Clock keys and IndexedDB names |
| --- | --- |
| Production | `foood`, `foood-private` |
| Local development | `foood-local`, `foood-local-private` |

This is more precise than waiting for a connected client with zero recipes. A
new account can legitimately be empty, but a previously created replica should
not have a clock without its database.

The check must happen before `createPollingPersistedDeltaClient()` runs. Client
construction immediately restores the old clock, opens/creates IndexedDB, starts
leader election, and may begin polling. Checking later loses the strongest
evidence because the missing database has already been recreated.

## Implementation

### 1. Extract the active prefix

In `examples/foood/src/index.js`, extract the current production/local selection
into a small function or module-level value so both startup recovery and `<Top />`
use exactly the same prefix.

The existing behavior remains:

- `foood-local` only when the hostname is `localhost` and
  `localStorage.useLocalFoood === "true"`;
- otherwise `foood`.

Avoid duplicating this condition in the recovery code.

### 2. Add a database-existence probe

Add a small helper near the Foood bootstrap code:

```js
databaseExists(name: string): Promise<boolean>
```

Preferred implementation:

1. If `indexedDB.databases` exists, use its database-name snapshot.
2. Otherwise, fall back to `indexedDB.open(name)` without a version.
3. In the fallback, treat `onupgradeneeded` with `oldVersion === 0` as
   "database was absent", abort that initial version-change transaction, and
   resolve `false`.
4. If the database already exists, close the successful connection immediately
   and resolve `true`.
5. Reject unexpected IndexedDB errors instead of interpreting them as definite
   data loss.

The fallback matters because `IDBFactory.databases()` only became broadly
available across current browsers in 2024. The open-and-abort probe uses the
older core IndexedDB API and does not intentionally leave behind an empty
database.

Reference:
[MDN: `IDBFactory.databases()`](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/databases).

### 3. Detect the split-persistence state

Add:

```js
needsReplicaRecovery(prefix: string): Promise<boolean>
```

Its logic:

1. Read `localStorage.getItem(prefix)` and
   `localStorage.getItem(prefix + "-private")` before constructing a client.
2. If neither clock exists, return `false`. This is a first-time client and
   missing databases are expected.
3. Check existence of both IndexedDB databases.
4. Return `true` if either expected database is absent.

If only one database is missing, recover both. Public and private clients share
the same login and should restart as a consistent pair.

Do not include `foood/auth` in the teardown or recovery decision. Authentication
must survive so the reload can immediately resync.

### 4. Perform the automatic teardown

Add:

```js
resetReplica(prefix: string): Promise<void>
```

It should:

1. Set a `sessionStorage` recovery guard before changing persistence.
2. Delete both IndexedDB databases and await both deletions:
   - `prefix`
   - `prefix + "-private"`
3. After both deletions succeed, remove the two clock keys:
   - `prefix`
   - `prefix + "-private"`
4. Leave `prefix + "/auth"` untouched.
5. Call `window.location.reload()` only after database deletion and clock removal
   succeed.

The existing `localStorageClockPersist(name).teardown()` export can remove the
clocks. Add a small app-local Promise wrapper around
`indexedDB.deleteDatabase(name)` for database deletion. It must handle:

- `onsuccess`: resolve;
- `onerror`: reject; and
- `onblocked`: reject with a useful message explaining that another Foood tab
  may still have the database open.

The existing `teardownDeltaPersistence()` has no `onblocked` handler, so using it
directly could leave startup waiting forever when another tab is open. Keep that
shared helper unchanged for this minimal app-specific patch.

If deletion rejects or becomes blocked, log a clear recovery error and continue
to the normal app without removing the clocks or reload-looping. The manual debug
action remains the fallback.

### 5. Add a reload-loop guard

Use a session-scoped key such as:

```text
${prefix}/automatic-recovery-attempted
```

If it is already set, do not attempt another automatic teardown in that tab.
Log the detected condition and continue loading so the debug page is still
reachable.

On the expected path, the first teardown removes both clocks. The reloaded
preflight sees no previous replica and proceeds normally. The guard is defensive
against browser deletion failures, stale database enumeration, or an unexpected
exception during startup.

Do not use a permanent localStorage guard for the primary detector; that would
prevent recovery after a later, genuine eviction.

### 6. Gate rendering on preflight

Make `run()` asynchronous:

1. Resolve the active prefix.
2. Run the preflight.
3. If recovery is needed, await teardown, trigger reload, and return without
   rendering.
4. Otherwise render `<Top />` exactly as today.

Wrap the preflight portion of `run()` in `try/catch`; log inspection errors and
then continue to the existing render path. `examples/foood/src/run.js` can also
attach a final catch handler to prevent an unhandled rejected Promise, but the
fail-open rendering decision belongs inside `run()`.

The bootstrap must fail open: inability to inspect IndexedDB should not make
Foood unavailable.

## Recovering users who are already stuck

The primary detector catches the next loss before the app recreates IndexedDB.
It cannot identify a database that was lost and then already recreated by an
earlier Foood load, because that empty database now exists.

Include a one-time deployment migration to rescue those clients:

1. Use a versioned localStorage marker such as
   `${prefix}/checked-empty-replica-v1`.
2. Only when the marker is absent and an old clock exists, open the existing
   public database and count `recipes:nodes`.
3. Write the marker after the check.
4. If the database has zero recipe nodes, run the same reset/reload path.

This may reset a genuinely empty existing account once. That is harmless: it
preserves auth, downloads an empty server database, and the versioned marker
prevents repeating the heuristic. This heuristic should be explicitly
one-time; ongoing detection must remain based on clock/database mismatch.

If minimizing the patch further is more important than automatically repairing
already-affected users, omit this migration. Those users would need one final
manual teardown, while future IndexedDB losses would recover automatically.

## Files to change

- `examples/foood/src/index.js`
  - centralize prefix selection;
  - add or import preflight helpers;
  - gate React rendering;
  - add the one-time rescue check if included.
- `examples/foood/src/run.js`
  - add top-level error handling for the asynchronous `run()` call if needed.

Keep the first implementation Foood-specific. No changes are required in
`packages/core`, `packages/idb`, the sync protocol, or the server.

If the bootstrap code becomes difficult to test in `index.js`, place the
IndexedDB probing/reset functions in a small
`examples/foood/src/recoverPersistence.js` module and keep `index.js` limited to
orchestration.

## Verification

### Primary regression

1. Log in and allow Foood to sync.
2. Confirm `localStorage.foood` and `localStorage["foood-private"]` exist.
3. Close the page so no IndexedDB connections remain.
4. Delete only IndexedDB databases `foood` and `foood-private`; preserve
   localStorage.
5. Open Foood.
6. Verify one automatic reload occurs.
7. Verify auth is preserved.
8. Verify both clock values have new session/node IDs.
9. Verify recipes and private content are downloaded.
10. Verify subsequent reloads do not trigger recovery.

### Additional cases

- First login with no clocks or databases: no recovery and no extra reload.
- Existing healthy replica: no recovery.
- Only `foood` missing: both replicas reset and one reload occurs.
- Only `foood-private` missing: both replicas reset and one reload occurs.
- Local development mode: only `foood-local*` data is inspected/reset.
- `indexedDB.databases()` unavailable: the fallback probe detects absence.
- IndexedDB inspection rejects: error is logged and the app remains usable.
- Database deletion rejects or is blocked: no reload loop; debug page remains
  available.
- Legitimately empty existing account during the one-time migration: at most one
  reset, then normal behavior.
- Already-recreated empty database: the one-time migration resets it and restores
  data.

### Build check

Run the Foood production build:

```sh
cd examples/foood
npm run build
```

Also exercise the installed/Home Screen form on at least one Android device,
because that is the dominant reported environment and its storage container may
behave differently from a normal Chrome tab.

## Deferred work

This patch intentionally does not:

- change the server's same-session delta filtering;
- add a full-resync protocol message;
- prove the cause of IndexedDB-only loss;
- request persistent browser storage;
- redefine the wifi icon as a replica-health indicator; or
- automatically treat every connected empty collection as corrupt.

Those remain useful hardening work, but they are not required for the smallest
automatic recovery patch.
