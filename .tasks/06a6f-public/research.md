# Public Foood recipe list and search

## Summary

Logged-out recipe detail pages are already intentionally public, but `/latest`
("All Recipes") and `/search` are only rendered inside the authenticated
application. Making those two pages public is not just a router change:

- the authenticated app creates a writable synchronized public client and a
  private per-user client, both using the login token;
- the public sync endpoint is protected by authentication and accepts writes;
- both list/search currently apply actor-specific recipe status behavior; and
- the list opens an authenticated sidebar containing edit/personalization
  controls.

The safest implementation is a separate logged-out, read-only browsing path that
fetches a snapshot of the public `recipes` collection and renders reusable
presentational versions of All Recipes and Search. It should reuse the existing
public recipe detail route for clicks. It should not create a private client or
make anonymous polling sync writable.

There is already an unauthenticated `/dump/` server endpoint that can enumerate a
collection in a database whose second path component is `public`. It returns CRDT
state rather than plain values, so it could support a minimal client-only change,
but a purpose-built public collection snapshot response would be a cleaner
contract and would avoid sending CRDT metadata and failed deltas to browsers.

## Current routing and authentication

`examples/foood/src/index.js:50-82` controls the logged-in/logged-out split:

- `/public/recipe/:id` always renders `PublicRecipe`.
- All other routes pass through `Auth` with `allowLoggedOut`.
- An authenticated user gets the full `App`.
- A logged-out user gets `PublicRecipe` only for `/recipe/:id`; every other URL,
  including `/latest` and `/search`, falls through to `SignUpIn`.

`Auth` itself already supports the required nullable authentication state
(`examples/shared/Auth.js:116-167`), so the auth helper does not need to change.
The Foood route selection is the gate that must be changed.

The authenticated app cannot currently be instantiated anonymously.
`examples/foood/src/App.js:69-97` requires `config.authData` and creates:

- a polling persisted client for `foood/public`; and
- a polling persisted client for `foood-private`.

Both URLs contain the user's auth token. The app then passes both clients through
routes and components (`examples/foood/src/App.js:178-320`) and derives
`actorId` from the logged-in user (`examples/foood/src/App.js:122`).

## Existing public data path

`PublicRecipe` fetches one recipe from:

```text
/latest/?db=foood/public&id=<id>&collection=recipes
```

and renders `RecipeInner` with `editorData={null}`
(`examples/foood/src/PublicRecipe.js:27-84`). `RecipeInner` already treats null
editor data as read-only: edit, status, queue, meal-plan, new-comment, and comment
editing controls are hidden (`examples/foood/src/Recipe.js:148-264`,
`:299-359`).

On the server, `getDb` treats database paths whose second component is `public`
as shared and does not require auth (`packages/server-bundle/full.js:170-197`).
This is used by:

- `/latest/`, which reconstructs and returns one plain collection value
  (`packages/server-bundle/full.js:286-307`); and
- `/dump/`, which reconstructs every node in a collection and returns
  `[nodes, failed]` (`packages/server-bundle/full.js:220-255`).

By contrast, all `/dbs/*` routes first use auth middleware
(`packages/server-bundle/full.js:146-167`). The polling endpoint processes
arbitrary client messages through the normal writable sync protocol
(`packages/server-bundle/poll.js:5-16`). Removing auth from that endpoint for
public databases would expose writes unless a new read-only protocol boundary
were added. That is unnecessary for these browsing pages.

Images are already rendered in public recipe detail using the same host URL, so
list thumbnails can continue using `imageUrl` as they do for authenticated
`RecipeBlock` instances.

## All Recipes behavior

The drawer labels `/latest` as "All Recipes"
(`examples/foood/src/Drawer.js:105-123`). `Latest`:

- reads the full `recipes` and `tags` collections from a client;
- removes trashed recipes;
- optionally filters on `recipe.statuses[actorId]`;
- sorts by `updatedDate` descending;
- progressively displays 15 recipes at a time; and
- opens `Sidebar` on wide screens

(`examples/foood/src/Latest.js:29-129`).

The tags collection is passed to `RecipeBlock`, but `RecipeBlock` does not
currently render it (`examples/foood/src/RecipeBlock.js:132-221`). A public All
Recipes page therefore only needs the recipes snapshot unless tags are added to
the card UI as part of this work.

The status buttons are user-specific. An anonymous user has no meaningful
`actorId`, and using the old fallback string (`main`) could expose accidental
data semantics or filter unpredictably. The public page should either omit these
buttons or define a deliberate aggregate/public status policy.

The sidebar is not suitable for anonymous use. It renders the authenticated
`Recipe` component and requires both public and private clients
(`examples/foood/src/Sidebar.js:200-247`). Public cards should navigate directly
to the already read-only `/recipe/:id[/title/:title]` route, without installing
the sidebar click override.

## Search behavior

`Search` reads recipes and tags from the synchronized client, debounces for 300
ms, searches recipe title and rendered Quill text, and displays title matches
before body matches (`examples/foood/src/Search.js:106-245`).

Its status behavior is also actor-specific:

- recipes rejected by `actorId` are omitted; and
- results use `sortRecipes`, which prioritizes `favorite`, `approved`, and
  `to try` for that actor before falling back to `updatedDate`

(`examples/foood/src/Search.js:211-234`,
`examples/foood/src/RecipeList.js:23-32`).

For anonymous search, the most neutral behavior is to include every non-trashed
recipe and sort by `updatedDate` descending within title/body result groups.
This must be confirmed because statuses are stored on otherwise public recipe
objects and may represent moderation rather than only personal preference.

The current search URL update concatenates raw input into the query string
(`examples/foood/src/Search.js:127-139`). While touching public search, it would
be prudent to use `URLSearchParams` or `encodeURIComponent` so terms containing
`&`, `#`, or `=` round-trip correctly.

## Recommended implementation

### 1. Add a plain public collection snapshot endpoint

Add a read-only route in `runMulti2`, adjacent to `/latest/`, that:

- requires `db` and `collection`;
- validates database path length and segments using the same rules as
  `dbMiddleware`;
- uses the existing `getDb` after validation, so only `*/public` databases are
  anonymous;
- reconstructs every node using the existing CRDT implementation;
- returns an object keyed by node ID containing `crdtImpl.value(node)`;
- omits CRDT metadata and failed raw deltas from the public response; and
- reports malformed requests, missing databases/collections, reconstruction
  failures, and server errors with explicit statuses.

This can be a new endpoint such as `/latest-collection/`. Alternatively,
`/latest/` could make `id` optional and return the collection when absent, but a
separate route gives the response shape a clearer contract.

The existing `/dump/` endpoint is a viable short-term fallback. The browser could
take the first tuple element and map each CRDT node to `.value` (or use
`clientCrdtImpl.value`). That minimizes server work but couples the UI to an
administrative/debug response and transfers more internal data than needed.

### 2. Add a logged-out public browsing shell

In `examples/foood/src/index.js`, extend the logged-out switch with explicit
routes for `/latest` and `/search` before the sign-in fallback. A small public
browsing shell should provide:

- Foood/home identity;
- navigation between All Recipes and Search; and
- a clear Login action.

Keep authenticated users on the existing `App`, so editing, private collections,
offline persistence, polling, and personalized status behavior remain unchanged.
The existing `/public/recipe/:id` alias can remain for compatibility.

### 3. Separate data loading from page rendering

Refactor `Latest` and `Search` so their list/search rendering can accept plain
recipe data. The authenticated wrappers can continue to obtain data with
`useCollection`; logged-out wrappers can obtain it with a shared public snapshot
hook.

Suggested boundaries:

- `usePublicRecipes(host)` owns fetch/loading/not-found/error/abort handling.
- A pure All Recipes view owns sorting, pagination, and rendering.
- A pure Search view owns query parsing, debounce, search, and rendering.
- Authentication-aware wrappers select the status policy and whether sidebar
  behavior is enabled.

Avoid passing a fake `privateClient`, fake collection, or fake actor ID into the
existing authenticated components. Those placeholders would make future mutation
paths easy to expose accidentally.

### 4. Make public cards link to public detail

Reuse `RecipeBlock`, but do not supply its `onClick` sidebar callback in public
mode. Its link already points to
`/recipe/:id/title/:escaped-title` (`examples/foood/src/RecipeBlock.js:153-220`);
the logged-out router should match this via `/recipe/:id` and render
`PublicRecipe`.

### 5. Preserve authenticated behavior

No authenticated route should change its client construction or status rules.
The public snapshot path should be read-only and need no IndexedDB replica,
session ID, sync-status icon, or private database.

## Error and loading states

The public collection loader should distinguish:

- loading;
- an empty recipe collection;
- a missing/unavailable public database;
- an HTTP/server error; and
- a malformed response.

`PublicRecipe` currently stores an `error` flag but never renders it and attempts
JSON parsing for non-404 error responses (`examples/foood/src/PublicRecipe.js:27-84`).
It would be consistent to improve that behavior while introducing the shared
public fetch layer, although it is not required to expose list/search.

## Test and verification plan

There are no Foood application tests in this checkout. This change should add
focused coverage at both boundaries:

1. Server tests:
   - anonymous public collection snapshot succeeds;
   - anonymous non-public database access returns 401;
   - unknown database/collection and malformed parameters return useful errors;
   - reconstructed values match the collection's current values;
   - failed reconstruction does not expose raw deltas.
2. Search unit tests:
   - title and body matches remain separated;
   - trashed recipes are excluded;
   - anonymous ordering follows the decided policy;
   - special characters survive query-string updates.
3. UI/router tests or browser verification:
   - logged-out `/latest` lists recipes;
   - logged-out `/search?q=...` returns results;
   - result clicks open a read-only recipe;
   - no edit/status/comment/queue/meal-plan controls appear;
   - login remains reachable;
   - authenticated `/latest` and `/search` retain personalized behavior.
4. Build verification:
   - run the Foood Parcel production build;
   - manually verify desktop and mobile layouts, empty/error states, pagination,
     direct URL loads, and browser back/forward navigation.

## Security and performance considerations

- This task changes public recipes from addressable-by-ID to enumerable. That is
  the intended consequence of public list/search, but it should be acknowledged
  because each recipe value includes comments, status maps, author IDs, source
  URLs, tags, and change-log data according to
  `examples/foood/collections.js:135-177`.
- Trashed recipes should be removed server-side if they are not meant to be
  public at all. Client-side filtering keeps them out of the UI but still sends
  them in the snapshot.
- A full recipe snapshot includes every recipe body and can become expensive.
  It matches the current authenticated local-search model and is likely adequate
  at the application's present scale, but the endpoint should support HTTP cache
  headers/ETags. Large-scale follow-up would use a public summary/search index
  and fetch full recipes individually.
- Do not make anonymous `/dbs/sync` writable. If live public sync is desired
  later, add a protocol-enforced read-only endpoint rather than relying on the
  client to refrain from writes.
- `getDb` does not currently duplicate `dbMiddleware`'s database path length and
  segment validation (`packages/server-bundle/full.js:113-144`, `:170-197`).
  Any new public collection endpoint should validate before resolving a
  filesystem path; ideally the existing `/latest/` and `/dump/` routes should be
  hardened through the same shared parser.

## Open questions

- Does "viewing all" specifically mean the existing `/latest` page, or should the
  logged-out root `/` also become a public recipe/tag home instead of the login
  screen?
    - logged-out root should show the home page (most recently added recipes) along with a link to login
- Should public users see all non-trashed recipes, or only recipes with a
  particular user's `approved`/`favorite` status?
    - all non-trashed recipes
- Are statuses purely personal, or do they double as publication/moderation
  state? Which actor, if any, is authoritative for public filtering?
    - purely personal
- Should public All Recipes retain the status filter buttons? If so, what do
  those labels mean without a logged-in actor?
    - nope, they should not be renderered
- Is it acceptable for enumeration/search to expose comments, per-user status
  maps, author IDs, recipe change logs, and source URLs already present in the
  public recipe object, or should the public response project a narrower shape?
    - yeah that's fine
- Should trashed recipes be omitted by the server response, rather than only
  filtered in the browser?
    - I don't care
- Should the existing `/dump/` endpoint be reused for the first implementation,
  or should this task add a stable plain-value collection endpoint?
    - sure we can use that
- How fresh must public results be? Is fetch-on-navigation with HTTP caching
  sufficient, or is live polling expected?
    - no polling. fetch on nav is fine
- Should logged-out list/search pages share the full app drawer, or use a smaller
  public navigation surface containing only All Recipes, Search, and Login?
    - hide nav items that aren't relevant to logged-out users
- Should `/public/recipe/:id` remain a supported canonical URL, redirect to
  `/recipe/:id`, or be removed after existing links are considered?
    - let's keep supporting it
- Are public recipe pages expected to work offline? The recommended snapshot
  approach is online-only unless explicit public caching is added.
    - it can be online-only
