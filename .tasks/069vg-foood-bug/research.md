# Foood blank-database investigation

## Summary

The strongest explanation is a **split loss of client persistence**:

1. Foood stores the replica/session identity in `localStorage` under `foood`.
2. It stores recipes, pending deltas, and the server cursor in IndexedDB under the
   same logical name.
3. IndexedDB is lost or becomes inaccessible, while `localStorage` survives.
4. The reloaded app therefore has an empty replica but reuses its old session ID.
5. The server excludes deltas written by that session ID, on the assumption that
   the originating replica already has them.
6. The poll succeeds, so the wifi icon says "connected", but the recipes cannot be
   reconstructed.

This also explains why normal reloads do not help and why **Teardown client** does:
teardown deletes both the IndexedDB database and the `localStorage` clock. The next
load generates a new session ID, so the server no longer filters out the old
session's deltas and sends the database history again.

Confidence is **high** that this is a real recovery bug and that it can produce the
reported symptoms. Confidence is **medium** that phone storage pressure is the
initial trigger. Current browser storage policy says normal eviction is
origin-wide, which should remove `localStorage` too. An IndexedDB-only WebKit
failure, old browser behavior, database corruption, or an app/container-specific
storage issue is a better fit until affected-device details are available.

## Relevant storage layout

Foood constructs its public client with the fixed prefix `foood`
(`examples/foood/src/index.js:87-93`) and uses
`createPollingPersistedDeltaClient` (`examples/foood/src/App.js:69-96`).

That constructor deliberately splits state across two browser APIs
(`packages/client-bundle/index.js:151-166`):

- `new PersistentClock(localStorageClockPersist(name))` stores the hybrid logical
  clock and its stable node/session ID in `localStorage`.
- `makeDeltaPersistence(name, ...)` stores collection nodes, unsent deltas, and
  per-collection server cursors in IndexedDB.

Authentication is also in `localStorage`, under `foood/auth`
(`examples/foood/src/index.js:55-66`,
`examples/shared/auth-api.js:8-23`). Thus an affected user remaining logged in is
direct evidence that at least the auth part of `localStorage` survived.

The IndexedDB schema keeps each collection in three object stores
(`packages/idb/src/delta.js:83-114`):

- `<collection>:nodes`
- `<collection>:deltas`
- `<collection>:meta`, whose `cursor` entry is the last server cursor

Node updates and cursor updates received in one sync response use the same
read-write transaction (`packages/idb/src/delta.js:20-49`), so ordinary transaction
failure should not leave only the cursor committed. The more plausible split is at
the storage-mechanism level: IndexedDB is gone/inaccessible, while `localStorage`
still contains the old identity.

## Failure sequence

### 1. The replica identity outlives the replica

`localStorageClockPersist` restores the packed clock unchanged
(`packages/core/src/persistent-clock.js:21-36`). The clock's node component becomes
the client's `sessionId` (`packages/core/src/delta/create-client.js:314-316`,
`:334-336`).

If IndexedDB opens as a new empty database, `loadAll()` returns no recipes and
`getServerCursor()` returns `undefined` (`packages/idb/src/delta.js:152-154`,
`:189-198`). The UI correctly renders the empty collection.

### 2. The client asks to sync with its old identity

Every polling request includes the persisted `sessionId`
(`packages/core/src/delta/polling-network.js:26-39`). A poll always sends a sync
message on reconnect, even when there are no local deltas
(`packages/core/src/delta/create-client.js:38-63`).

### 3. The server omits the history needed by the empty replica

The SQLite server query always excludes rows whose `sessionId` equals the current
client's session ID (`packages/server-bundle/sqlite-persistence.js:152-169`).
That optimization is valid only while the replica still possesses its own writes.
After IndexedDB loss, it does not.

There is a second reinforcing problem when the server process still remembers this
session. A sync message with a null cursor does not replace an existing non-null
cursor (`packages/core/src/server.js:185-193`). The server may therefore continue
from the old high-water mark rather than honor the empty replica's request to
start over.

Even after a server restart, the same-session filter is enough to lose data:
`deltasSince(null, sessionId)` returns all history **except** rows authored by that
session. If this phone created most recipes, the database can look completely
empty; if other replicas contributed data, it may instead look incomplete.

### 4. "Connected" does not mean "replica is complete"

The polling network marks the client connected whenever the HTTP request,
response parsing, and message handling succeed
(`packages/core/src/delta/polling-network.js:48-63`, `:89-99`). It does not verify
that any recipes exist, that a full history was returned, or that local state
matches the server.

The top bar directly maps that status to the wifi icon
(`examples/shared/TopBar.js:23-66`). The icon therefore means only "the last poll
succeeded", not "the local database is populated and consistent."

### 5. Teardown changes the identity

The debug button calls `client.teardown()`
(`examples/shared/Debug.js:21-30`). Teardown:

- removes the clock/session ID from `localStorage`;
- closes the network; and
- deletes the IndexedDB database

(`packages/core/src/delta/create-client.js:344-349`,
`packages/core/src/persistent-clock.js:31-33`,
`packages/idb/src/delta.js:131-145`).

On the subsequent client construction, a new random clock node is generated
(`packages/core/src/persistent-clock.js:50-56`). The server sees the historical
deltas as belonging to other sessions and returns them. This is the key evidence
linking the report to the identity/history-filter interaction.

## Why phones and storage pressure are plausible but unproven

Browser-managed IndexedDB is best-effort storage unless the origin has obtained
persistent storage. Low device space can trigger eviction. WebKit also documents
storage-pressure and least-recently-used eviction, and Safari has had storage-loss
bugs. See:

- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Apple Developer Forums: iOS 17 PWA IndexedDB/localStorage failures](https://developer.apple.com/forums/thread/737827)

However, current documented eviction is origin-wide: WebKit says it normally
deletes an origin as a whole, and MDN says eviction deletes all of an origin's
managed data rather than selected pieces. WebKit's inactivity policy also lists
both IndexedDB and `localStorage`. A standards-conforming whole-origin eviction
would log the user out and generate a new clock, which should avoid this exact
failure.

Therefore storage pressure may expose the recovery bug only if the affected
browser/version loses IndexedDB separately, IndexedDB fails to open/read while
`localStorage` remains available, or the app is running in a container with
different persistence behavior. Reports being phone-only make iOS/WebKit version
and Home Screen installation mode especially important.

Foood does not call `navigator.storage.persist()`, inspect
`navigator.storage.estimate()`, or handle/report storage durability. It also has
no startup consistency check relating node count to the stored server cursor.

## Deterministic reproduction

The hypothesis can be tested without simulating disk pressure:

1. In a fresh browser profile, load Foood and create a recipe. Ensure this client
   is the only author of that recipe.
2. Record `localStorage.foood` and confirm IndexedDB database `foood` contains
   recipe nodes and a recipe cursor.
3. Delete **only** IndexedDB database `foood`, leaving `localStorage.foood` and
   `localStorage["foood/auth"]` intact.
4. Reload.
5. Expected result: the user remains logged in, the wifi icon becomes connected,
   and some or all same-session recipes remain absent across reloads.
6. Remove only `localStorage.foood` (or use Teardown client), then reload.
7. Expected result: a new session ID is generated and the missing recipes are
   downloaded.

It is worth running the same scenario both with and without restarting the server.
Without restart, the retained server cursor should make the failure stronger.
With restart, same-session history should still be absent because the SQL query
filters it.

## Recommended follow-up

The protocol should not use the writer session ID as a permanent reason to omit
history when a client requests a full rebuild. The safest direction is:

1. Give the sync protocol an explicit full-resync/reset request.
2. On that request, ignore both the server's in-memory cursor for the session and
   the `sessionId != ?` optimization.
3. Detect an empty/missing IndexedDB replica paired with an existing persisted
   identity, rotate the identity or issue the explicit full-resync automatically.
4. Add a regression test for "replica storage deleted, identity retained."
5. Make sync health distinguish transport connectivity from initial data load and
   replica consistency.
6. Add startup diagnostics: browser/OS, standalone mode, database presence,
   per-collection node/delta counts, cursor values, session ID, storage estimate,
   and whether persistent storage was granted.

Rotating the session ID whenever IndexedDB lacks a cursor is a small mitigation,
but an explicit protocol-level full resync is more robust. Identity and cursor
state currently live in separate persistence systems, so the protocol must tolerate
either one surviving without the other.

## Open questions

- What browser and exact OS versions are affected? On iOS, all major browsers may
  still share WebKit behavior depending on OS/browser configuration.
    - I think it's mostly android
- Is Foood opened in a normal browser tab or installed to the Home Screen?
    - both
- Do affected users remain authenticated without re-entering credentials? The
  report implies yes, but confirming this proves `localStorage` survived.
    - yes they remain authenticated
- Are **all** recipes missing, or only recipes primarily authored on that phone?
    - all recipes
- Are tags, meal plans, and private collections also missing? Public and private
  data use separate IndexedDB databases (`foood` and `foood-private`).
    - all content is lost
- How much free device storage remained when the incident occurred?
    - no sure
- Did it follow an OS/browser update, app offloading, clearing website data, a
  crash, or a long period without opening Foood?
    - probably a long period without opening Foood
- At failure time, does `indexedDB.databases()` show `foood` at version 3, and what
  are the node counts and cursor values in each collection?
    - not sure
- Does `localStorage.foood` still contain the same clock node as before the loss?
    - not sure
- Does the server still have an in-memory entry for that session, and what cursor
  does it hold per collection?
    - not sure
- Does restarting the server change recovery behavior before teardown?
    - no
- Are there server rows authored by multiple session IDs, and does the broken
  client recover only the rows from other IDs?
    - not sure
- Has the deployed server/client revision diverged from this checkout in any of
  the sync, persistence, or teardown code?
    - no
