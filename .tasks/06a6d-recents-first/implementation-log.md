# Implementation log

## Phase 1: Per-user recipe access

- Added optional `Homepage.recentRecipes`, backed by an optional private
  map-of-number schema field, so existing private records remain compatible.
- Added access recording to `RecipeView`; this covers full recipe pages and the
  desktop preview while leaving editor-only visits untracked.
- The recorder waits for both recipe and private homepage loading, initializes a
  missing `homepage/default` with the existing queue defaults, and writes one
  timestamp per mounted recipe ID.
- Guarded against stale `useItem` data when a route ID changes and against the
  private update retriggering an infinite write/render loop.

Issues encountered:

- Flow inferred the route-derived recipe ID too broadly to use as a computed map
  key. Added an explicit `string` annotation to retain the existing runtime
  behavior and satisfy the map type.
- The CRDT cannot apply a nested map update through an absent optional field on
  a legacy homepage record. The recorder now initializes the complete
  `recentRecipes` map for that first access, then uses granular per-recipe
  updates after the map exists.

## Phase 2: Recent-recipe dashboard

- Added deterministic selectors for recently viewed and recently updated recipe
  IDs, filtering missing/trashed records, limiting each list to ten, and using
  recipe ID as the timestamp tie-break.
- Replaced the root tag gallery with shared `RecipeBlock` sections for
  `Recently viewed` and `Recently added or updated`.
- Kept the current meal plan first and reused one preview-sidebar state across
  both new sections.
- The private history reader treats loading, a missing homepage record, and a
  missing optional history map as empty; the viewed section is hidden in all
  three cases.

Issues encountered: none.

## Phase 3: All Tags navigation

- Moved the former home tag gallery into `AllTags`, preserving its non-trashed
  recipe counts, approved/favorite ranking, tile rendering, and empty state.
- Added the `/tags` route before the catch-all home route and set the page title
  to `All Tags | Foood`.
- Added `All Tags` beside `All Recipes` in the drawer and retained the five
  direct ranked tag shortcuts.

Issues encountered: none.

## Phase 4: Verification

- Formatted all touched Foood source files with Foood's local Prettier 2.8.8.
- `npm run build` completed successfully and emitted the updated production
  bundle.
- Started the Parcel development server at `http://localhost:1236`; both `/` and
  the new `/tags` history-fallback URL return HTTP 200.
- Confirmed the built bundle contains the two recent-section headings and the
  `All Tags` navigation/page text.
- Ran an in-memory private-client check against a legacy `homepage/default`
  record: initializing the optional map and then adding a second nested recipe
  timestamp both persisted correctly.
- Ran Flow twice. It initially identified the new computed-key annotation issue;
  after the fix, the project error count dropped from 38 to its remaining 37
  pre-existing errors, with no errors in the new home or All Tags code.
- `git diff --check` passes.

Issues and workarounds:

- Parcel reports that `parcel-plugin-workbox-cache` cannot find
  `.workbox-config.js`. This warning predates the change and does not prevent
  either production or development builds.
- Flow cannot start inside the filesystem sandbox because `shm_open` is blocked;
  it ran after allowing the Flow check to create shared memory.
- The in-memory client script required `regenerator-runtime/runtime` before
  Babel-registering the Flow sources.
- An initial formatting pass used the root Prettier 1.19.1 and changed untouched
  arrow-function syntax. Rerunning Foood's local Prettier 2.8.8 removed that
  unrelated churn.
- Browser UI automation could not initialize because the browser-control runtime
  failed with `Cannot redefine property: process`. Route serving and compiled
  output were verified, but interactive desktop/mobile screenshots and
  authenticated recipe workflows remain manual checks.

## Follow-up: View all recent updates

- Added a `View all` link beside `Recently added or updated` that navigates to
  `/latest`.
- Kept the shared section heading responsive so the title and link can wrap
  together on narrow screens.
- `npm run build` passes, and the development server returns HTTP 200 for
  `/latest`.

Issue encountered: Parcel could not reuse configured port `1236`, so it selected
`63610` for this verification run.
