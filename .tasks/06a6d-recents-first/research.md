# Foood recent-recipes home page

## Summary

This change can be implemented within the existing Foood architecture without a
new server API or query primitive:

1. Store each user's recipe access timestamps in the private database.
2. Record an access when `RecipeView` successfully resolves a recipe.
3. On the home page, resolve and sort that private history for "Recently viewed."
4. Sort the shared recipe collection by `updatedDate` for "Recently added or
   updated."
5. Move the existing tag gallery to a dedicated `/tags` route and link it from the
   navigation drawer as "All Tags."

The shared recipe collection is already loaded in full on the home page, so both
ten-item lists can be derived in memory. The only new persisted data is the
per-user access history.

The best fit with the current model is an optional map on the existing private
`homepage/default` record:

```js
recentRecipes: {
    [recipeId: string]: number, // last accessed timestamp
}
```

An optional field preserves compatibility with existing private records. A map
also makes a single `setAttribute` update independent per recipe under the
existing nested-object CRDT.

## Current behavior

### Routing and home page

`App` creates two clients: a shared `foood/public` client and a per-user
`foood-private` client (`examples/foood/src/App.js:69-96`). The current user's
numeric user ID is exposed as `actorId` (`examples/foood/src/App.js:117-123`).

The route switch sends both `/tag/:tagid` and the catch-all home route to
`Home` (`examples/foood/src/App.js:269-276`, `:312-319`). Recipe routes are
declared before the catch-all and render `RecipeView` (`examples/foood/src/App.js:
277-300`).

`Home` loads every recipe and tag via `useCollection`
(`examples/foood/src/Home.js:119-133`). When there is no `tagid`, it renders:

- the current meal plan, if present; then
- the complete tag gallery, ranked by the current user's approved/favorite recipe
  counts and then total recipe counts

(`examples/foood/src/Home.js:138-171`, `:221-256`). A tag route reuses the same
component but renders `RecipeList` instead (`examples/foood/src/Home.js:179-219`).

The current meal-plan block should be left in place unless the task intends the
two recent lists to replace it too. The wording "instead of showing just the
tags" suggests replacing the tag gallery, not the meal plan.

### Recipe rendering

`RecipeBlock` is the reusable tile used by the home meal plan, tag recipe lists,
and the all-recipes page. It links to the recipe's title URL and, on wide screens,
can intercept the link to open a preview sidebar (`examples/foood/src/
RecipeBlock.js:132-164`, `:189-220`).

The preview `Sidebar` renders the same `Recipe`/`RecipeView` component with an
explicit recipe ID (`examples/foood/src/Sidebar.js:200-248`). Consequently,
placing access tracking in `RecipeView` would count both:

- navigation to a full recipe page; and
- opening a recipe in the desktop preview sidebar.

`RecipeView` is the narrowest common point at which a recipe is known to exist.
It loads the recipe and handles loading/not-found states before rendering it
(`examples/foood/src/Recipe.js:299-331`). Tracking should happen only after
`recipe` is a real object, not while `useItem` returns `false` for loading or
`null` for missing (`packages/client-react/index.js:69-109`).

### Existing recent-update behavior

Recipes already have required `createdDate` and `updatedDate` fields in both the
Flow type and schema (`examples/foood/collections.js:135-149`, `:181-209`).
Creation initializes both fields to the same current timestamp
(`examples/foood/src/App.js:190-210`), and every editor save advances
`updatedDate` (`examples/foood/src/EditorView.js:49-90`).

`Latest` already implements the relevant shared ordering: exclude trashed
recipes, then sort descending by `updatedDate` (`examples/foood/src/Latest.js:
55-61`). Thus "recently added/updated" can use the first ten results of that same
ordering. Using `updatedDate` covers new recipes because it is initialized on
creation. No `max(createdDate, updatedDate)` is needed unless legacy data can
contain an `updatedDate` older than `createdDate`.

`Latest` also contains the needed recipe-tile layout and preview-sidebar pattern
(`examples/foood/src/Latest.js:97-126`). This can be extracted or reproduced as a
small home-page section rather than reusing `Latest` itself, whose status filters,
infinite-scroll behavior, and 15-item batch size do not apply here.

### Private data and initialization

The private schema has a singleton `Homepage` record containing tag categories
and the recipe queue (`examples/foood/private-collections.js:135-166`). Queue
code loads `homepage/default`, creates it when it is missing, and otherwise
updates a nested map attribute (`examples/foood/src/QueueButton.js:26-53`).

Adding `recentRecipes` to this record is consistent with its role and avoids
putting personal activity in shared `RecipeT`. It should be optional in both the
Flow type and schema so existing records remain readable:

```js
recentRecipes?: { [recipeId: string]: number },

// schema
recentRecipes: {
    type: 'optional',
    value: { type: 'map', value: 'number' },
},
```

When an access occurs:

- if `homepage/default` exists, call
  `setAttribute('default', ['recentRecipes', recipeId], Date.now())`;
- if it is missing, save the normal complete default shape plus the initial
  `recentRecipes` entry;
- if it is still loading (`false`), wait rather than creating a competing record.

The home-page reader should treat a missing map as `{}`. It should discard access
IDs whose shared recipe is missing or trashed before sorting and slicing. The map
can grow indefinitely if entries are never removed; that is likely acceptable
for current Foood data sizes, but pruning is an optional follow-up.

## Navigation and All Tags

The drawer currently contains Home, Meal Plans, Recipe queue, All Recipes, and
then five high-ranked direct tag links (`examples/foood/src/Drawer.js:81-125`).
There is no route for the complete tag gallery other than `/`.

Recommended routing:

- `/` renders the meal plan and the two recent-recipe sections;
- `/tags` renders the existing complete tag gallery;
- `/tag/:tagid` continues rendering a single tag's recipes;
- the drawer adds an `All Tags` link to `/tags`.

The `/tags` route must be declared before the catch-all route in `App`. The
existing tag-gallery calculations and markup can be moved into an `AllTags`
component, or `Home` can distinguish `/tags`; a separate component is clearer
because tag detail and dashboard concerns are already diverging.

The five direct tag shortcuts can technically remain. Whether they should remain
is a product decision: adding `All Tags` satisfies the request without removing
them, while removing them makes the drawer shorter and avoids two competing tag
navigation patterns.

## Recommended implementation shape

1. Extend `Homepage` and `HomepageSchema` with optional `recentRecipes`.
2. Add a small hook/component around `useItem(privateClient, 'homepage',
   'default')` that records the resolved recipe ID in `RecipeView`.
3. Add a reusable recipe-row/section component that accepts an ID list, renders
   up to ten `RecipeBlock`s, and owns the existing preview-sidebar interaction.
4. Derive `recentlyViewedIds` from private access timestamps, filtering missing
   and trashed recipes, sorting newest first, and slicing to ten.
5. Derive `recentlyUpdatedIds` from non-trashed recipes sorted by `updatedDate`
   descending and sliced to ten.
6. Render explicit empty states for a new user with no view history and for an
   empty shared recipe collection.
7. Move the current tag gallery to `/tags` and add `All Tags` to `Drawer`.

The two sections may contain the same recipe. They represent different concepts,
so deduplicating the second list is not implied by the task and could cause it to
show fewer than ten or require scanning farther into the shared ordering.

## Verification

Foood has no app-specific test files or test script; its package scripts expose
only build/start/deploy commands (`examples/foood/package.json`). Verification
should therefore include:

- run the Foood production build to catch Flow/Babel/schema errors;
- open recipes via both full navigation and desktop preview and confirm timestamps
  update;
- revisit an older recipe and confirm it moves to the front of Recently viewed;
- edit a recipe and confirm it moves to the front of Recently added or updated;
- confirm another user's accesses do not affect the current user's list;
- confirm missing/trashed recipes do not render in either section;
- verify zero, fewer than ten, exactly ten, and more than ten recipes;
- verify `/tags`, `/tag/:tagid`, `/latest`, and `/` route independently and the
  drawer link closes/navigates normally;
- check mobile and desktop layouts, including the wide-screen preview behavior.

Focused unit tests would be worthwhile if a Foood test harness is introduced:
pure helpers for filtering/sorting IDs can cover limits, timestamp ties, missing
records, trashed records, and absent private history without mounting the app.

## Open questions

- Does opening the desktop preview sidebar count as "accessed," or only a full
  recipe-page navigation? Tracking in `RecipeView` counts both.
    - yes, both
- Should accessing a recipe through an editor route count, or only viewing the
  rendered recipe? The recommended placement counts only rendered views.
    - only viewing
- Should the existing current meal plan remain above the two recent sections?
  The task appears to replace only the tag gallery.
    - sure
- What headings should be shown? Suggested labels are `Recently viewed` and
  `Recently added or updated`.
    - sure
- Should rejected recipes be eligible? Existing `Latest` includes every
  non-trashed recipe unless the user applies a status filter, so the recommended
  behavior includes rejected recipes.
    - yeah that's fine
- Should "recently added/updated" sort strictly by `updatedDate`, as `Latest`
  already does, or by `max(createdDate, updatedDate)` to defend against legacy
  data?
    - updatedDate is fine
- Should the same recipe be allowed in both lists? The recommendation is yes.
    - yes
- Should the drawer keep its five direct tag shortcuts after adding `All Tags`?
    - yes
- Should `/tags` be the canonical All Tags URL, and should any old/bookmarked URL
  preserve access to the former home tag gallery? There is no old dedicated URL
  to redirect.
    - no need for a redirect
- What should the empty Recently viewed state say for a new user?
    - just hide it
- Is unbounded last-access history acceptable, or should the private map be
  pruned to a fixed size? Keeping more than ten entries allows the UI to backfill
  when recipes are trashed or removed.
    - unbounded is fine
- For equal timestamps, should ordering use a deterministic secondary key such as
  recipe ID or title? Millisecond ties are unlikely but possible during imports
  or tests.
    - sure, recipe ID is fine
