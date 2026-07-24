# Public Foood browsing plan

## Goal

Allow logged-out users to:

- open `/` and see the most recently added non-trashed recipes;
- open `/latest` and browse all non-trashed recipes;
- open `/search` and search all non-trashed recipes; and
- open either existing public recipe URL form.

Anonymous browsing will be online-only and read-only. It will fetch public recipe
data on navigation through the existing `/dump/` endpoint, without creating a
sync client, private client, IndexedDB replica, or polling connection.

Authenticated behavior must remain unchanged: logged-in users keep personalized
status filtering/sorting, desktop recipe previews, editing, comments, queue and
meal-plan actions, offline persistence, and polling sync.

## Settled behavior

- `/` is the logged-out public home instead of the sign-in form.
- Public home shows the newest non-trashed recipes by `createdDate`.
- `/latest` shows every non-trashed recipe ordered by `updatedDate`, using the
  existing progressive list display.
- Anonymous users do not see recipe status filter buttons.
- Public search includes all non-trashed recipes, including recipes rejected by
  any logged-in user.
- Anonymous search results are ordered by `updatedDate` within title and body
  match groups; personal statuses do not affect them.
- Recipe status maps and the other fields already in public recipe objects do not
  need to be projected out.
- Public data is fetched when entering a public view. It is not polled and does
  not need offline support.
- Logged-out navigation includes only Home, All Recipes, Search, and Login.
- `/public/recipe/:id` remains supported.
- Public list/search cards navigate to a read-only detail page and do not open
  the authenticated desktop sidebar.
- Use the existing `/dump/` response rather than adding a new server endpoint.

## Phase 1: Add the public snapshot loader

### Create a focused public-data module

Add `examples/foood/src/publicRecipes.js` (or an equivalently named module) with:

```js
usePublicRecipes(host: string): {
    status: 'loading' | 'ready' | 'error',
    recipes: { [id: string]: RecipeT },
    error: ?Error,
}
```

The hook should:

1. Build the server origin using the same localhost HTTP versus production HTTPS
   rule already used by Foood.
2. Fetch:

   ```text
   /dump/?db=foood/public&collection=recipes
   ```

3. Require an HTTP 200 response before parsing JSON.
4. Validate the top-level `[nodes, failed]` tuple shape enough to avoid rendering
   arbitrary malformed responses.
5. Convert each CRDT node to its plain recipe value using
   `clientCrdtImpl.value(node)` rather than reaching into `.value` throughout the
   UI.
6. Return only nodes that resolve to recipe-shaped objects with an ID.
7. Surface request and response-shape failures as an error state.
8. Report any entries in the `failed` object to the console while still showing
   successfully reconstructed recipes.
9. Use an effect cleanup flag or `AbortController` so a response cannot update an
   unmounted route.

Keep this loader read-only. It must not instantiate any client-bundle client,
persist data, send a session ID, or call `/dbs/sync`.

### Add reusable load-state rendering

Add a small public-view boundary, either in the same module or the public shell,
that renders:

- a stable loading state;
- a useful fetch/error message; and
- the child view when recipes are ready.

An empty successful snapshot should render the view's empty state, not an error.

## Phase 2: Separate recipe views from authenticated data access

### Refactor All Recipes

Update `examples/foood/src/Latest.js` to separate:

- the existing authenticated wrapper that reads `recipes` and `tags` with
  `useCollection`; and
- a reusable `LatestView` that accepts plain recipe data and rendering policy.

The reusable view should accept enough information to express both modes:

```js
{
    recipes,
    tags,
    actorId,
    showStatusFilters,
    onSelectRecipe,
    url,
}
```

Behavior:

- Always remove recipes with `trashedDate != null`.
- Always sort the base All Recipes list by `updatedDate` descending.
- Add a recipe-ID tie-break so equal timestamps render deterministically.
- Render the current status buttons only when `showStatusFilters` is true and an
  authenticated `actorId` is present.
- Keep the existing 15-item progressive display, scroll expansion, and Show More
  fallback.
- Add an explicit empty state when no eligible recipes exist.
- Supply `onClick` to `RecipeBlock` only when `onSelectRecipe` exists.

The current default export should remain the authenticated wrapper so
`examples/foood/src/App.js` needs little or no behavioral change. It should pass
the current actor ID, enable status controls, and retain the existing sidebar.

### Refactor Search

Update `examples/foood/src/Search.js` in the same pattern:

- retain an authenticated wrapper that obtains collection data;
- export a reusable search view that accepts plain recipes/tags and an optional
  actor ID or explicit search policy; and
- export pure search helpers where useful for focused tests.

Change `runSearch` so the policy is explicit:

- Authenticated mode keeps excluding recipes rejected by the current actor and
  keeps the existing status-aware `sortRecipes` ordering.
- Public mode excludes only trashed recipes and sorts by `updatedDate` descending
  with a recipe-ID tie-break.
- Both modes preserve title-match-before-body-match grouping and the current
  Show More behavior.

Also replace raw query-string concatenation with `URLSearchParams` or properly
encoded query construction. Searching for text containing `&`, `=`, `#`, spaces,
or Unicode must preserve the complete query and browser history behavior.

Do not pass a fake actor ID such as `main` into public search. The absence of an
actor must select the anonymous policy directly.

### Keep cards mode-neutral

Continue reusing `RecipeBlock` for both modes:

- authenticated list views that already support desktop previews may pass the
  existing sidebar callback;
- public views omit `onClick`, so the block follows its normal recipe link; and
- public callers may pass an empty tags object because `RecipeBlock` does not
  currently display tags.

No private-client or mutation capability should be added to `RecipeBlock`.

## Phase 3: Build the logged-out public views

### Public home

Add `examples/foood/src/PublicHome.js`:

- load recipes with `usePublicRecipes`;
- exclude trashed recipes;
- sort by `createdDate` descending with recipe ID as a deterministic tie-break;
- render a bounded recent section using the first 15 recipes;
- render the existing `RecipeBlock` visual treatment without sidebar callbacks;
- include a visible route to `/latest` for the complete collection;
- render a clear empty state; and
- set the document title to `Foood`.

This is a distinct logged-out home. Do not reuse authenticated `Home`, because
that component reads the private current meal plan and renders personalized tag
ordering/sidebar behavior.

### Public All Recipes

Add `examples/foood/src/PublicLatest.js` or a thin exported wrapper:

- fetch recipes with `usePublicRecipes`;
- render the refactored `LatestView`;
- pass no actor ID;
- disable status controls;
- pass no sidebar selection callback; and
- set the same All Recipes page title used by the authenticated view.

### Public search

Add `examples/foood/src/PublicSearch.js` or a thin exported wrapper:

- fetch recipes with `usePublicRecipes`;
- render the refactored Search view in anonymous mode;
- pass no actor ID;
- preserve direct `/search?q=...` loading; and
- retain the current debounced search and result grouping.

Each public route can fetch independently when mounted. A shared cross-route cache
is not required for this task.

## Phase 4: Add a public shell and routing

### Create reduced public navigation

Add `examples/foood/src/PublicShell.js` with the existing Material UI visual
language:

- an app bar linking the Foood title to `/`;
- a drawer/menu containing Home, All Recipes, Search, and Login;
- an optional top-bar search icon linking to `/search`; and
- a content container matching the current app spacing.

Do not show Meal Plans, Recipe Queue, tags, Manage Ingredients, Debug, Add Recipe,
sync status, account identity, or logout to anonymous users.

Use a dedicated public drawer rather than trying to render the existing `Drawer`
with a fake client. The current drawer reads recipes/tags from a client and
contains authenticated-only destinations.

### Add a dedicated login route

Once `/` becomes public, links labeled Login can no longer point to `/`. Add a
logged-out `/login` route that renders:

```jsx
<SignUpIn host={host} storageKey={prefix + '/auth'} />
```

Update `PublicRecipe` and the new public shell so every Login action points to
`/login`.

After a successful login, the existing auth listener should rerender the
authenticated `App`. If the browser remains at `/login`, redirect to `/` or add
an authenticated `/login` route redirect so the full app does not treat it as
its catch-all home accidentally.

### Update logged-out route selection

Update `examples/foood/src/index.js` so the logged-out branch matches routes in
specific-to-general order:

1. `/login` -> `SignUpIn`
2. `/recipe/:id` -> public read-only recipe
3. `/latest` -> public All Recipes
4. `/search` -> public Search
5. `/` -> public Home

Wrap the public home/list/search/detail views in `PublicShell`, either once around
their switch or through a focused layout route.

Keep the outer `/public/recipe/:id` route working for both logged-in and
logged-out visitors. Render it with the same public shell and read-only recipe
view, preserving the current compatibility behavior.

Authenticated visitors must still enter `App` for `/`, `/latest`, `/search`, and
`/recipe/:id`; only `/public/recipe/:id` should force the public read-only view as
it does today.

### Normalize PublicRecipe's view boundary

Refactor `examples/foood/src/PublicRecipe.js` so it renders recipe content and
load/error states without owning a conflicting second app bar when already inside
`PublicShell`.

While touching its fetch handling:

- render the existing not-found state on 404;
- render a visible error for non-OK responses and network failures;
- do not attempt JSON parsing after a non-OK response; and
- abort or ignore stale requests on route changes.

## Phase 5: Verification and cleanup

### Static verification

- Run `git diff --check`.
- Run the Foood production build from `examples/foood`.
- Resolve Flow, Babel, Parcel, import, and hook errors.
- Remove imports/styles made obsolete by splitting `Latest`, `Search`, and
  `PublicRecipe`.
- Confirm no server, schema, sync protocol, or private collection change was
  introduced.

### Public data loading

- Load each public route while logged out and confirm exactly one snapshot fetch
  occurs per mounted list/search/home view.
- Confirm no `/dbs/sync` request, auth token, polling timer, IndexedDB database,
  or private database access is created by anonymous browsing.
- Verify loading, empty snapshot, malformed response, HTTP error, and partial
  `/dump/` failure behavior.
- Confirm navigating away before a slow request completes does not produce a
  stale state update.

### Public home and All Recipes

- Confirm logged-out `/` shows the 15 newest non-trashed recipes by
  `createdDate`, with deterministic ordering for ties.
- Confirm the public home links to `/latest`.
- Confirm `/latest` excludes trashed recipes, sorts by `updatedDate`, initially
  shows 15, and expands by scroll or Show More.
- Confirm public `/latest` has no favorite/approved/to-try/rejected filter
  buttons.
- Confirm clicking a public recipe card navigates to a read-only detail page
  instead of opening a desktop sidebar.

### Public search

- Confirm blank search, no-results, title-match, body-match, and Show More states.
- Confirm trashed recipes are absent and rejected recipes remain searchable.
- Confirm anonymous ordering is independent of every user's status map.
- Verify direct loads and edits for queries containing spaces, `&`, `=`, `#`,
  and Unicode.
- Confirm a result click opens the read-only detail page.

### Navigation and detail

- Confirm the public drawer contains only Home, All Recipes, Search, and Login.
- Confirm `/login` shows the existing sign-up/sign-in UI.
- Log in from `/login` and confirm the authenticated app opens without remaining
  on an ambiguous catch-all route.
- Confirm `/recipe/:id`, `/recipe/:id/title/:title`, and
  `/public/recipe/:id` all remain usable while logged out.
- Confirm public recipe detail hides edit, personal statuses, queue, meal-plan,
  new-comment, and comment-edit controls.
- Confirm public detail renders recipe images and uploaded content correctly.

### Authenticated regression

- Confirm authenticated `/`, `/latest`, `/search`, tag routes, recipe preview,
  recipe detail, and editing still use the synchronized public/private clients.
- Confirm authenticated All Recipes still displays and applies personal status
  filters.
- Confirm authenticated search still excludes the current user's rejected
  recipes and retains status-aware sorting.
- Confirm wide-screen sidebar previews still work on authenticated views that
  currently provide them, including All Recipes.
- Confirm login/logout and existing offline data continue to work.

### Responsive browser verification

- Check public home, All Recipes, Search, drawer, login, and recipe detail at
  desktop and mobile widths.
- Verify app bar controls, query input, recipe tiles, loading/error text, and
  navigation do not overlap or overflow.
- Verify browser back/forward navigation preserves route and search query state.

## Expected files

- `examples/foood/src/publicRecipes.js` (new)
- `examples/foood/src/PublicShell.js` (new)
- `examples/foood/src/PublicHome.js` (new)
- `examples/foood/src/PublicLatest.js` (new, unless colocated with `Latest`)
- `examples/foood/src/PublicSearch.js` (new, unless colocated with `Search`)
- `examples/foood/src/index.js`
- `examples/foood/src/PublicRecipe.js`
- `examples/foood/src/Latest.js`
- `examples/foood/src/Search.js`

No changes are expected in `packages/server-bundle`, Foood collection schemas,
the sync protocol, or private collection components.
