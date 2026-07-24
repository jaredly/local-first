# Foood recent-recipes home page plan

## Goal

Replace the tag gallery on `/` with:

- up to ten recipes most recently viewed by the current user; and
- up to ten recipes most recently added or updated by any user.

Keep the current meal plan above those sections. Move the complete tag gallery to
`/tags`, add an `All Tags` drawer item, and retain the five existing direct tag
shortcuts.

## Settled behavior

- Opening either a full recipe page or the desktop preview counts as viewing a
  recipe.
- Opening the editor does not count.
- `Recently viewed` is hidden when the user has no valid history.
- `Recently added or updated` sorts by `updatedDate`.
- Trashed or missing recipes are excluded from both sections.
- Rejected recipes remain eligible.
- A recipe may appear in both sections.
- Each section is limited to ten recipes.
- Equal timestamps are ordered by recipe ID for deterministic output.
- View history remains unbounded so older valid recipes can backfill the first
  ten when newer entries are deleted or trashed.
- `/tags` is the new canonical tag-gallery route; no redirect is needed.

## Phase 1: Persist per-user recipe access

### Extend the private schema

Update `examples/foood/private-collections.js`:

- Add optional `recentRecipes?: { [recipeId: string]: number }` to `Homepage`.
- Add the matching optional map-of-number field to `HomepageSchema`.
- Keep the field optional so existing `homepage/default` records require no data
  migration and existing queue/meal-plan readers continue to work.

### Record successful recipe views

Update `examples/foood/src/Recipe.js`:

- Load `homepage/default` from `privateClient` inside `RecipeView` or a focused
  `useRecordRecipeAccess` hook.
- After the shared recipe has resolved to a real recipe, record
  `Date.now()` at `['recentRecipes', recipe.id]`.
- If `homepage/default` is missing, create it with the complete existing default
  shape:

  ```js
  {
      id: 'default',
      categories: [],
      recipeQueue: {},
      recentRecipes: { [recipe.id]: Date.now() },
  }
  ```

- If the homepage record is still loading (`false`), do not write until loading
  finishes.
- Guard the effect with a ref keyed by recipe ID so the private update does not
  cause another timestamp write on the resulting rerender.
- Mark the recipe ID as recorded before starting the async write to avoid
  duplicate writes during rapid rerenders.
- Report write failures without breaking recipe rendering.

Because the desktop `Sidebar` renders `RecipeView` with an override ID, this
placement records both accepted view paths while leaving `/recipe/:id/edit`
untracked.

## Phase 2: Build the recent-recipe dashboard

Update `examples/foood/src/Home.js`.

### Read private history

- Load `homepage/default` using `privateClient`.
- Treat loading, a missing record, and a missing `recentRecipes` field as an
  empty history for rendering.

### Derive the two ID lists

Create small pure helpers, either near `Home` or in an appropriately named local
module:

- `getRecentlyViewedRecipeIds(recipes, recentRecipes, limit)`
  - start from private history entries;
  - discard IDs not present in the shared collection;
  - discard recipes with `trashedDate != null`;
  - sort by access timestamp descending;
  - break equal timestamps by recipe ID;
  - return the first ten IDs.

- `getRecentlyUpdatedRecipeIds(recipes, limit)`
  - start from all shared recipe IDs;
  - discard recipes with `trashedDate != null`;
  - sort by `updatedDate` descending;
  - break equal timestamps by recipe ID;
  - return the first ten IDs.

Use an explicit ascending or descending recipe-ID tie-break consistently and
cover it during verification.

### Render the sections

- Keep `CurrentMealPlan` as the first home-page block.
- Add a small reusable home-page section component that renders a heading and a
  stable flex/wrapping list of `RecipeBlock`s.
- Render `Recently viewed` only when its filtered ID list is non-empty.
- Render `Recently added or updated` when there are eligible shared recipes.
- Pass the existing `url`, `actorId`, recipe data, and tags to each
  `RecipeBlock`.
- Reuse one `sidebar` state and the existing `Sidebar` instance so recipe tiles
  from either section open the desktop preview.
- Remove the tag gallery from the `/` rendering branch.
- Remove imports, styles, and calculations from `Home` only when they are no
  longer needed by tag detail or the extracted All Tags view.

The display should reuse the current recipe-tile visual language rather than
introducing a second recipe representation.

## Phase 3: Move the tag gallery to All Tags

### Extract the gallery

Create `examples/foood/src/AllTags.js` or an equivalent focused component by
moving the current home tag-gallery behavior:

- load shared recipes and tags;
- exclude trashed recipes from counts;
- calculate total and current-user approved/favorite counts;
- rank tags using the existing ordering;
- render the existing `Tag` tiles and `No tags defined` empty state;
- set an appropriate page title, such as `All Tags | Foood`.

Keep `/tag/:tagid` behavior in `Home` unchanged unless a small rename/refactor is
needed to make the split clear.

### Add routing

Update `examples/foood/src/App.js`:

- Import the All Tags component.
- Add `/tags` to the route switch before the catch-all home route.
- Pass `client`, `actorId`, and `url` as required by the extracted component.
- Leave `/tag/:tagid`, `/latest`, recipe routes, and `/` behavior intact.

### Add drawer navigation

Update `examples/foood/src/Drawer.js`:

- Add an `All Tags` list item linking to `/tags`.
- Keep `All Recipes` and the five ranked direct tag links.
- Place `All Tags` with the recipe/tag navigation group so its relationship to
  the direct shortcuts is clear.

## Phase 4: Verification and cleanup

### Static verification

- Run `git diff --check`.
- Run the Foood production build from `examples/foood`.
- Resolve all Flow/Babel/schema/import errors.
- Review the diff for unused imports and styles left by moving the tag gallery.

### Access tracking

- Start with no `homepage/default`; open a recipe and confirm the record is
  created without breaking queue defaults.
- Start with an existing homepage record that lacks `recentRecipes`; open a
  recipe and confirm the optional map is added.
- Open a recipe as a full page and confirm it becomes the first recent item.
- Open another recipe in the desktop preview and confirm it also becomes first.
- Reopen an older recipe and confirm only its timestamp changes and it moves to
  the front.
- Open the editor directly and confirm it does not change access history.
- Confirm one view produces one write rather than a render/write loop.

### List behavior

- Verify zero, fewer than ten, exactly ten, and more than ten valid history
  entries.
- Confirm `Recently viewed` is absent for a new user.
- Confirm both sections cap at ten.
- Confirm a recipe may appear in both lists.
- Edit an older recipe and confirm it moves to the front of
  `Recently added or updated`.
- Confirm missing and trashed recipes are skipped and older valid history entries
  backfill the viewed list.
- Confirm rejected, non-trashed recipes remain eligible.
- Confirm equal timestamps produce recipe-ID-stable ordering.

### Navigation and layout

- Verify `/` shows the meal plan followed by the recent sections.
- Verify `/tags` shows the complete former home tag gallery.
- Verify `/tag/:tagid`, `/latest`, recipe permalinks, and edit routes still work.
- Verify the drawer contains Home, All Recipes, All Tags, and the five direct tag
  shortcuts and that each navigates correctly.
- Check desktop and mobile widths for heading/tile wrapping, overflow, and
  preview-sidebar behavior.

## Expected files

- `examples/foood/private-collections.js`
- `examples/foood/src/Recipe.js`
- `examples/foood/src/Home.js`
- `examples/foood/src/AllTags.js` (new, if extracted as recommended)
- `examples/foood/src/App.js`
- `examples/foood/src/Drawer.js`

No public recipe schema migration, server endpoint, or sync-protocol change should
be required.
