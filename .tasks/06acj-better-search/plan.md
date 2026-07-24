# Foood fuzzy search plan

## Goal

Replace title substring matching with Fuse-backed fuzzy search while preserving
Foood's existing personalized search behavior:

- tolerate missing/extra spaces, punctuation differences, diacritics, and normal
  spelling mistakes in recipe titles;
- keep results grouped into `Title match` and `Contents match`;
- retain recipe-status bins as the primary ordering;
- keep body search non-fuzzy but normalize it for separator and diacritic
  differences;
- continue excluding trashed recipes and recipes rejected by the current user;
  and
- preserve the existing debounce, progressive result display, and URL-backed
  query.

No server, schema, persistence, or dependency changes are required. Foood already
depends on Fuse 6.4.3.

## Settled behavior

- Only recipe titles receive fuzzy matching.
- Recipe bodies use exact normalized/compact substring matching, not Fuse.
- Search covers title and recipe body only. Source, author, tags, comments, and
  metadata remain out of scope.
- Diacritics are folded, so a query such as `creme` can match `crème`.
- Spaces and common punctuation are ignored by compact matching, so
  `chickenpot` and `chicken pot` match each other.
- Queries whose normalized compact form has fewer than three characters use
  exact/compact matching only; they do not invoke fuzzy matching.
- Results remain split into `Title match` and `Contents match`.
- A recipe that matches both appears only in `Title match`.
- Recipe status remains the primary result bin:
  `favorite`, `approved`, `to try`, then unset/null.
- Within a status bin, title results sort by match quality, then recency and a
  stable ID tie-break.
- Body results retain status-first ordering, with normalized exact matches ahead
  of compact-only matches, then recency and recipe ID.
- Recipes rejected by the current actor remain hidden.
- Recipes rejected by a different actor remain eligible unless the current actor
  has also rejected them.
- Trashed recipes remain hidden.

Consequently, a weaker favorite title match can appear before a stronger approved
title match because status bins remain primary. Within the favorite bin, the
stronger match appears first.

## Phase 1: Extract and implement search logic

### Add a pure search module

Create `examples/foood/src/searchRecipes.js`.

Move or reimplement the non-React search concerns there:

- Quill delta-to-text conversion;
- query and document normalization;
- eligible-recipe document construction;
- Fuse title search;
- title/body classification and deduplication; and
- status-aware result ordering.

Export focused helpers where they improve testing, with the main API shaped as:

```js
searchRecipes(
    recipes: { [id: string]: RecipeT },
    query: string,
    actorId: string,
): ?{
    titleMatches: Array<string>,
    bodyMatches: Array<string>,
}
```

Return `null` for an empty or normalization-only query so the current empty-search
UI remains blank rather than showing `No results`.

### Normalize searchable text

Implement one shared normalization pipeline for queries, titles, and bodies:

1. convert to lowercase;
2. apply Unicode decomposition;
3. remove combining diacritic marks;
4. normalize runs of whitespace and common punctuation to a single separator;
5. trim leading/trailing separators; and
6. derive a compact form by removing those separators entirely.

Keep both normalized and compact forms:

```js
{
    normalizedTitle,
    compactTitle,
    normalizedContents,
    compactContents,
}
```

Do not remove meaningful letters or digits from non-English text while compacting
separators. Keep the implementation compatible with the project's existing Babel
and browser targets.

Normalization should make these deterministic:

- `Chicken Pot Pie` matches `chickenpot`;
- `ChickenPot Pie` matches `chicken pot`;
- `Crème Brûlée` matches `creme brulee`;
- punctuation variants such as `mac-and-cheese` and `mac and cheese` match.

### Build eligible search documents

For every recipe:

- exclude it when `trashedDate != null`;
- exclude it when `recipe.statuses[actorId] === 'rejected'`;
- retain missing current-actor statuses as the unset status bin;
- flatten `recipe.contents.text` using only string Quill inserts; and
- store the recipe ID and normalized title/body fields.

Non-string Quill embeds should remain ignored, matching current behavior.

### Add title matching tiers

Classify title matches into these quality tiers:

1. normalized title contains the normalized query;
2. compact title contains the compact query;
3. Fuse fuzzy title match.

Run Fuse only when the compact query has at least three characters. Configure the
title index with:

- `keys: ['normalizedTitle']`;
- `includeScore: true`;
- `ignoreLocation: true`; and
- an initial threshold in the researched `0.3` to `0.4` range.

Start with a named constant such as `TITLE_FUZZY_THRESHOLD` so tuning is local and
reviewable. Select the final initial value against the unit-test examples and a
small set of real titles; do not expose it as UI configuration.

Deduplicate by recipe ID while retaining the recipe's best match tier and Fuse
score. Exact normalized and compact matches must never be demoted to the fuzzy
tier merely because Fuse also returns them.

### Add body matching

Do not run Fuse over bodies.

A body matches when either:

- its normalized text contains the normalized query; or
- its compact text contains the compact query.

Classify normalized substring matches ahead of compact-only matches. Exclude every
ID already present in the title result set so each recipe renders once.

### Apply status-aware ordering

Use the existing status order from
`examples/foood/src/RecipeList.js` rather than defining a divergent order.

For title results, compare:

1. current-actor status-bin index;
2. match tier;
3. Fuse score for fuzzy results;
4. `updatedDate` descending; and
5. recipe ID for deterministic ties.

For body results, compare:

1. current-actor status-bin index;
2. normalized match before compact-only match;
3. `updatedDate` descending; and
4. recipe ID for deterministic ties.

Avoid calling the current `sortRecipes` over an already Fuse-sorted array because
that would discard fuzzy relevance within each status bin. Either add a small
status-bin helper beside `statusOrder` or compose the comparator explicitly in
the new module.

## Phase 2: Integrate search with the React view

Update `examples/foood/src/Search.js`.

### Replace the inline search helper

- Import the new pure search/index helpers.
- Remove the inline `runSearch` and `deltaToString`.
- Remove unused `Fuse` and other imports that are no longer needed.
- Update render access from positional tuple indexes to
  `results.titleMatches` and `results.bodyMatches`.
- Preserve title-first pagination and the shared 15-item result budget.
- Preserve the current `Title match`, `Contents match`, `Show more`, and
  `No results` behavior.

### Avoid rebuilding body text per keystroke

Build normalized search documents and the Fuse title index with `React.useMemo`
when `recipes` or `actorId` changes. Search the prepared data when the debounced
query changes.

If keeping `searchRecipes(recipes, query, actorId)` as the public pure API is
simpler for tests, expose a lower-level prepare/search pair for the component:

```js
const index = prepareRecipeSearch(recipes, actorId);
const results = runRecipeSearch(index, query);
```

The one-shot API can delegate to those helpers. This keeps test ergonomics while
avoiding repeated Quill body flattening in the UI.

### Retain and clean up debounce behavior

- Keep the 300 ms delay.
- Ensure recipe/index changes also refresh results.
- Reset `showUpTo` to 15 immediately when the query changes.
- Remove the existing `set up` and `bounced` debug logs.
- Verify a stale result does not remain visible after the query is cleared.

### Encode the URL query correctly

Replace:

```js
history.replace(match.path + '?q=' + evt.target.value);
```

with `URLSearchParams`-based query construction so spaces, `+`, `&`, `=`, `#`,
Unicode, and diacritics round-trip correctly.

Preserve direct `/search?q=...` loading and browser back/forward behavior. Decide
consistently whether an empty value produces `/search` or `/search?q=`; prefer
removing `q` when the input is empty.

## Phase 3: Add focused test coverage

### Add a Foood test entry point

Foood currently has no test script. Add the smallest Jest configuration consistent
with the repository:

- add a `test` script in `examples/foood/package.json` using the root Jest binary;
- configure Babel/Jest to transform Flow syntax with
  `@babel/preset-env` and `@babel/preset-flow`; and
- avoid adding new packages when the root toolchain already supplies them.

Keep tests focused on the pure module so Material UI, routing, DOM setup, and
collection clients are not required.

### Add search unit tests

Create `examples/foood/src/searchRecipes.test.js` with compact recipe builders and
tests for:

- spaces present in the title but absent in the query;
- spaces absent in the title but present in the query;
- punctuation/separator variants;
- diacritic folding in both directions where applicable;
- case folding;
- one-character insertion/deletion;
- a common transposition;
- a clearly unrelated title excluded by the threshold;
- normalized exact ahead of compact exact within one status bin;
- compact exact ahead of fuzzy within one status bin;
- closer fuzzy matches ahead of weaker fuzzy matches within one status bin;
- favorite before approved before `to try` before unset, even when a later bin
  has a stronger textual match;
- `updatedDate` and recipe-ID tie-breaks within equal status/match quality;
- one- and two-character queries returning exact/compact matches but not fuzzy
  matches;
- multiple-word queries;
- normalized and compact body substring matches;
- no fuzzy-only body match;
- title matches removed from the body group;
- trashed recipes excluded;
- recipes rejected by the current actor excluded;
- recipes rejected only by another actor included;
- empty and separator-only queries returning `null`; and
- Quill embeds ignored without breaking string body search.

Assert result inclusion and relative ordering rather than raw Fuse score numbers.
This allows threshold or library tuning without coupling tests to internal score
precision.

### Cover URL construction

Extract URL query construction into a small helper if needed to unit-test that:

- `&`, `=`, `#`, and `+` remain part of the query value;
- spaces and Unicode round-trip through `URLSearchParams`; and
- clearing the query removes the `q` parameter without disturbing any explicitly
  preserved parameters.

If the route owns no other meaningful parameters, replacing the full search
parameter set is acceptable and should be documented by the test.

## Phase 4: Build and browser verification

### Automated checks

- Run the new Foood search unit tests.
- Run the Foood production Parcel build.
- Run `git diff --check`.
- Resolve Flow/Babel/Jest/import errors.
- Confirm the existing `fuse.js` dependency and lockfile remain unchanged.

### Search behavior

Using real recipe data, verify:

- missing and extra spaces find the expected title;
- punctuation and diacritic variants find the expected title;
- a modest typo finds the expected title;
- unrelated recipes are not visibly admitted;
- one- and two-character inputs do not flood the results;
- status bins remain favorite, approved, `to try`, then unset;
- match relevance is correct within each status bin;
- exact body text still finds recipes;
- a typo that occurs only in the body does not match;
- rejected and trashed recipes remain hidden; and
- a recipe matching title and body appears only under `Title match`.

Tune `TITLE_FUZZY_THRESHOLD` only if representative titles show false positives
or obvious false negatives, then encode the desired boundary in behavioral tests.

### UI and navigation

- Verify empty input renders no result message.
- Verify a non-empty query with no matches renders `No results`.
- Verify direct `/search?q=...` URLs populate the field and results.
- Verify `+`, `&`, `=`, `#`, spaces, Unicode, and diacritics survive editing,
  reload, and browser back/forward navigation.
- Type rapidly and confirm results settle on the latest query after 300 ms.
- Confirm `Show more` still allocates its 15-item budget across title results
  before body results.
- Confirm changing the query resets pagination.
- Confirm result cards still open the expected recipes.
- Check search layout and result sections at mobile and desktop widths.

## Expected files

- `examples/foood/src/searchRecipes.js` (new)
- `examples/foood/src/searchRecipes.test.js` (new)
- `examples/foood/src/Search.js`
- `examples/foood/package.json`

A separate Jest configuration file is optional; the configuration may live in
`examples/foood/package.json` if that matches the existing package conventions.

No changes should be needed in recipe schemas, collection clients, server routes,
or `yarn.lock`.
