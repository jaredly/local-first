# Foood fuzzy search implementation log

## Phase 1: Search engine

-   Added `src/searchRecipes.js` with reusable prepare/search APIs.
-   Added Unicode diacritic folding plus normalized and separator-free compact
    forms for titles and recipe bodies.
-   Added exact, compact, and Fuse title tiers. Fuse runs only for queries of at
    least three compact characters with a `0.4` threshold.
-   Kept bodies non-fuzzy and deduplicated body hits against title hits.
-   Added status-first authenticated ordering and retained recency-first anonymous
    ordering required by the existing public-search view.

Issue/workaround: `SearchView` already supports logged-out public search from
another change. The new engine accepts a nullable actor ID so that work is
preserved instead of making fuzzy search authenticated-only.

## Phase 2: React integration

-   Replaced the inline search implementation with the named
    `titleMatches`/`bodyMatches` result API.
-   Memoized document normalization and Fuse index construction by recipe
    collection and actor, while retaining the 300 ms query debounce.
-   Preserved the existing 15-result shared pagination budget and both result
    sections.
-   Kept the existing `URLSearchParams` query encoding and exported `runSearch` as
    a compatibility alias for the new one-shot search API.
-   Empty or separator-only queries now hide results immediately instead of
    retaining a debounced stale result.

Issue/workaround: URL encoding and debug-log cleanup described by the plan were
already present in `Search.js`; the integration retained those changes rather
than rewriting them.

## Phase 3: Tests

-   Added a lightweight Foood Jest command and Flow transform without adding or
    updating dependencies.
-   Added 26 unit tests covering normalization, Fuse typo matching, status bins,
    match tiers, short queries, body behavior, eligibility, stable ordering, Quill
    embeds, anonymous ordering, and URL query round-tripping.
-   Extracted `statusOrder`/`sortRecipes` into `src/recipeSorting.js` so the pure
    search tests do not load the full React/Material UI recipe-list module.
-   Extracted `updateSearchQuery` into `src/searchQuery.js` and wired the view to it.
-   Result: 26 tests passing.

Issues/workarounds:

-   Jest attempted to use Watchman, whose state path is not writable in the
    sandbox, and exited without running tests. Added `--no-watchman` to make test
    execution deterministic.
-   The root install has Jest but no top-level `babel-jest`. The test config points
    to the compatible transformer bundled with Jest, avoiding a lockfile change.
-   NFD normalization decomposed Japanese voiced characters even though only Latin
    combining marks were removed. Recompose with NFC after diacritic folding so
    non-Latin text retains its normal representation.

## Phase 4: Build and runtime verification

-   `npm test`: 26 tests passing.
-   `npm run build`: production Parcel bundle completed successfully.
-   `git diff --check`: clean.
-   Confirmed the running development server returns HTTP 200 for a direct
    `/search?q=...` URL.
-   Development server: `http://127.0.0.1:1234` (configured port 1236 was already
    occupied, so the verification server was restarted on an available port).

Issues/limitations:

-   Parcel reports that `parcel-plugin-workbox-cache` cannot find
    `.workbox-config.js`. This is pre-existing and non-fatal; the build completes.
    No service-worker configuration was added as part of search.
-   Browser-control setup failed with `Cannot redefine property: process`, so
    interactive visual verification could not be completed through the connected
    browser. Search behavior, URL handling, bundle compilation, and the local HTTP
    route were still verified through tests/build/runtime checks.
