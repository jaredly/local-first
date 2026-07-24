# Implementation log

## Phase 1: Public recipe snapshot loader

-   Added `publicRecipes.js` with `/dump/` fetching, CRDT value decoding,
    lightweight response validation, partial-reconstruction reporting, and
    loading/error states.
-   The loader uses only `fetch`; it does not create clients, persistence, sync
    sessions, or polling.

## Phase 2: Reusable list and search views

-   Split All Recipes into an authenticated data wrapper and reusable
    `LatestView`.
-   Split Search into an authenticated data wrapper and reusable `SearchView`.
-   Added explicit anonymous ordering/filtering policies and deterministic ID
    tie-breaks while preserving authenticated status behavior.
-   Fixed search query updates to encode reserved characters correctly.
-   Fixed an existing inefficiency where the All Recipes scroll listener was
    removed and re-added on every render; it now installs once.
-   Early production build passed. Parcel emitted the existing
    `parcel-plugin-workbox-cache` warning because `.workbox-config.js` is absent,
    but the bundle completed successfully.

## Phase 3: Logged-out recipe pages

-   Added a public home showing the 15 newest non-trashed recipes by `createdDate`
    with an All Recipes link.
-   Added anonymous All Recipes and Search wrappers over the shared loader and
    reusable views.
-   Public cards have no preview callback or actor identity, so they navigate to
    read-only recipe routes and do not apply personal status styling.

## Phase 4: Public shell and routing

-   Added a reduced public shell with Home, All Recipes, Search, and Login only.
-   Added `/login`; authenticated visits to that route redirect to `/` after the
    auth state updates.
-   Logged-out `/`, `/latest`, `/search`, and `/recipe/:id` now use the public
    pages while authenticated routes still use the full `App`.
-   Preserved `/public/recipe/:id` as an always-read-only compatibility route.
-   Refactored `PublicRecipe` to share the public shell and fixed its existing
    silent network-error behavior and non-OK JSON parsing bug.

## Phase 5: Verification and fixes

-   Production build passes after the public routing changes.
-   Flow initially found new missing annotations in public dump decoding and
    search result sorting; both were corrected.
-   Full Flow verification remains blocked by existing repository errors,
    including missing Foood admin import fixtures/modules, dependency resolution
    failures, and an unrelated `Home.js` `viewAllTo` prop mismatch.
-   The live public dump was verified as a valid two-item tuple with 1,889 recipe
    nodes and no reconstruction failures.
-   Issue: the live dump is approximately 9.4 MB. This is the cost of the chosen
    existing `/dump/` workaround and should be replaced by a smaller public
    summary/search representation if load time becomes unacceptable.
-   Verified the production dump allows the local app origin through CORS.
-   Verified direct local requests to `/`, `/latest`, `/search`, `/login`,
    `/recipe/:id`, and `/public/recipe/:id` all receive the SPA entrypoint.
-   The local dev server initially failed to bind inside the filesystem sandbox;
    running the same project script with the required local-listener permission
    worked.
-   Visual browser verification could not run because the in-app browser connection
    failed during initialization with `Cannot redefine property: process`. No
    standalone browser runner was substituted, so responsive layout and click
    behavior still need a manual browser pass.
-   A direct Node decode harness also hit the repository's mixed Flow/ES-module
    loading boundary. The decoder was instead verified through the successful
    Parcel build, Flow checking of the touched file, and inspection of the live
    response shape.

## Follow-up: SPA snapshot cache

-   Added a host-keyed, module-scoped public recipe cache with a five-minute fresh
    window.
-   SPA transitions within five minutes render cached recipes immediately and do
    not issue another dump request.
-   After five minutes, views render stale data immediately while refreshing in
    the background. Refresh failures retain the cached recipes and are logged
    rather than replacing useful content with an error.
-   Concurrent transitions share one in-flight refresh, avoiding duplicate dump
    downloads.
-   The cache is intentionally memory-only, so a full page refresh starts with an
    empty cache and fetches current data.

## Follow-up: Back navigation and recipe loading

-   Bug: public recipe detail ignored the already-loaded dump cache and always
    entered `Loading recipe...` while issuing a separate item request.
-   Public detail now renders a cached recipe synchronously. It skips the item
    request while the dump is fresh and revalidates the item in the background
    when the dump is stale.
-   A successful item revalidation updates that recipe inside the dump cache
    without marking the rest of the dump as newly fetched.
-   Public recipe cards no longer receive `RecipeBlock`'s optional preview click
    handler. They now use React Router's normal Link behavior directly, removing
    an unnecessary event-handler layer from forward/back SPA navigation.
-   Production build and formatting checks pass after both navigation fixes. The
    existing missing `.workbox-config.js` Parcel warning remains non-fatal.

## Follow-up: Public All Recipes sidebar

-   Public `/latest` now uses the same desktop recipe-preview interaction as the
    authenticated list.
-   The sidebar renders the recipe already present in the public dump cache through
    `RecipeInner` with no editor data, so opening it is immediate and read-only.
-   Mobile behavior remains unchanged: below the existing 800px sidebar threshold,
    recipe cards navigate to the full recipe page.
-   Extracted the shared sidebar frame from the authenticated sidebar and fixed its
    permalink button to prevent the browser's default navigation before pushing
    the route through React Router.
-   Production and live development builds pass. Focused Flow checking reports no
    errors in the two changed modules, but still exits nonzero because of the
    previously documented repository-wide dependency and unrelated source errors.

## Follow-up: Home recipe sidebars

-   Logged-out home recipe cards now open the same immediate, read-only sidebar on
    desktop and retain full-page navigation below the existing 800px threshold.
-   Extracted the public sidebar recipe composition into a shared component used
    by both the public home and public All Recipes screens.
-   Confirmed the authenticated home already applies its editable sidebar callback
    to current meal-plan, recently viewed, and recently updated recipe cards, so no
    authenticated behavior change was needed.
-   Production and live development builds pass. Focused Flow checking found no
    errors in the new or changed public modules before exiting on the same 19
    existing repository errors.
