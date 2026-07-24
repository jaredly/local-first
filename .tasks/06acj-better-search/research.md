# Foood fuzzy search

## Summary

Foood search is local and operates over the complete in-memory recipe collection,
so this change does not require a server endpoint or search index service. The
main work belongs in `examples/foood/src/Search.js`.

The repository already has the appropriate search library:

- `fuse.js` 6.4.3 is a Foood dependency
  (`examples/foood/package.json`, `examples/foood/yarn.lock`);
- `Search.js` still imports `Fuse`, although the import is unused
  (`examples/foood/src/Search.js:10`); and
- the first search implementation used a weighted Fuse search over title, source,
  and contents. Commit `36dc9db` replaced it with exact substring matching and
  commented out the Fuse call.

The recommended first scope is:

1. Keep the current eligibility rules and title/body result sections.
2. Make title matching separator-insensitive so adding or omitting spaces and
   punctuation is deterministic.
3. Use Fuse scores for typo-tolerant title matching and relevance ordering.
4. Keep body matching exact/normalized initially, or use a separately configured,
   stricter Fuse search if fuzzy bodies are explicitly desired.
5. Extract the pure search logic and add focused tests before tuning thresholds.

Using separate title and body searches is preferable to one weighted Fuse index.
It preserves the existing UI contract, prevents weak body matches from competing
with title matches, and permits different thresholds for short titles and long
recipe bodies.

## Current behavior

### Search flow

`App` routes `/search` to `Search` and supplies the public collection client,
current `actorId`, and asset URL (`examples/foood/src/App.js:267-269`).
`Search` loads all recipes and tags using `useCollection`
(`examples/foood/src/Search.js:106-110`).

The query is stored in the URL as `q`. Each change replaces the current history
entry and resets pagination. Search execution is debounced by 300 ms
(`examples/foood/src/Search.js:113-123`, `:127-139`).

Results are presented in two ordered groups:

- `Title match`
- `Contents match`, excluding recipes already in the title group

The two groups share one 15-item pagination budget, with title results always
shown first (`examples/foood/src/Search.js:140-183`).

### Matching and filtering

`runSearch` returns no result set for a whitespace-only query. Otherwise, it:

1. excludes trashed recipes;
2. excludes recipes whose status for this actor is `rejected`;
3. lowercases the title;
4. flattens the Quill body to its textual inserts and lowercases it;
5. uses `String.includes` against the entire query; and
6. sorts each group with the normal recipe status/update ordering.

See `examples/foood/src/Search.js:205-236`.

The exact substring comparison causes the reported separator problem. For
example, `chickenpot` does not occur in `Chicken Pot Pie`, and `chicken pot` does
not occur in `ChickenPot Pie`. It also provides no tolerance for misspellings,
transpositions, partial multi-word queries, or punctuation differences.

`deltaToString` concatenates only string Quill inserts and ignores embeds
(`examples/foood/src/Search.js:247-248`). That is a reasonable searchable body:
it includes rendered ingredient/instruction text without indexing formatting
metadata.

### Existing sort semantics

`sortRecipes` ranks recipes by the current user's status (`favorite`, `approved`,
`to try`, then unset/rejected) and then by descending `updatedDate`
(`examples/foood/src/RecipeList.js:23-31`). Search currently applies this after
matching, so it has no concept of relevance within a section.

A fuzzy implementation should rank primarily by match score. Applying
`sortRecipes` to the complete fuzzy result list would discard Fuse's relevance
ordering. It can remain a deterministic tie-breaker for equal or near-equal
scores if the existing personalization is desired.

## Fuse.js fit and constraints

Fuse 6.4.3 is sufficient for this data size and runs entirely in the browser. It
supports weighted keys, score-based sorting, match metadata, and configurable
threshold/location behavior. No dependency change is needed.

The defaults should not be accepted without tuning:

- the default threshold is `0.6`, which can admit visibly unrelated titles;
- location defaults to the start of the string with a distance of 100;
- long bodies can therefore behave differently depending on where text occurs;
- very short queries can produce many weak fuzzy matches; and
- one index containing both title and body makes result classification and
  threshold selection harder.

For title search, a starting point is `includeScore: true`,
`ignoreLocation: true`, and a threshold around `0.3` to `0.4`. The exact value
should be selected using representative real recipe titles, not treated as an
API constant with self-evident meaning.

Fuse handles many missing-space and typo cases, but separator-insensitive
normalization should still be explicit because it is the task's concrete
acceptance case. A helper can lowercase and Unicode-normalize text, then remove
whitespace and punctuation for an exact "compact title" tier. Search should:

1. put exact raw title matches first;
2. then put exact compact-title matches;
3. then append Fuse title matches by ascending score; and
4. deduplicate IDs across tiers.

This guarantees `chickenpot`/`chicken pot` behavior while Fuse supplies broader
typo tolerance. Normalization should be shared by query and indexed values.

## Recommended implementation shape

### Pure search module

Move `runSearch`, `deltaToString`, and normalization into a small module such as
`examples/foood/src/searchRecipes.js`. Export a pure function returning the
current shape:

```js
{
    titleMatches: Array<string>,
    bodyMatches: Array<string>,
}
```

A named object is clearer than the current positional tuple and makes future
match metadata or snippets easier to add. The React component can still paginate
the combined groups exactly as it does now.

Build searchable documents only from eligible recipes:

```js
{
    id,
    title,
    normalizedTitle,
    compactTitle,
    contents
}
```

Preserve both existing exclusions: `trashedDate != null` and current-actor
`rejected`. Missing status entries already remain eligible.

### Ranking

Use relevance as the primary title ordering:

1. exact raw substring;
2. exact compact substring;
3. fuzzy score;
4. existing `sortRecipes` result;
5. recipe ID as a stable final tie-breaker.

Exact substring and compact matches should also be present in the Fuse result, so
deduplication must preserve the earliest/best tier.

For short queries, consider requiring exact/compact matches below three
characters rather than running fuzzy search. Otherwise a one-letter query may
return much of the collection.

### Body search

The safest initial behavior is normalized exact substring matching for bodies,
excluding all title-match IDs. It keeps today's useful ingredient/instruction
search while the title search solves the stated problem.

If fuzzy body search is in scope, use a second Fuse index with:

- a stricter threshold than titles;
- `ignoreLocation: true`, because relevant ingredients may occur late;
- title-match IDs removed; and
- exact body matches ranked ahead of fuzzy body matches.

Do not combine title and body into one weighted score if the UI continues to
label separate match types. A combined index would require `includeMatches` and
classification rules when both fields match, and a long body can distort the
score through field-length normalization.

### React integration and performance

The collection is already fully resident, and the existing debounce limits work
while typing. For a modest personal recipe collection, rebuilding the small
index when `recipes` changes is adequate. Prefer `useMemo` for document/index
construction and debounce only the query search; this avoids re-flattening every
Quill body on every query.

Keep the existing 15-result progressive rendering. Reset it when the query
changes, as today.

While editing query handling, construct the next query with `URLSearchParams`.
The current string concatenation does not encode `&`, `#`, `=`, or `+`
correctly (`examples/foood/src/Search.js:131-133`), which can corrupt legitimate
search text.

The debug `console.log` calls in `useDebounce` should also be removed
(`examples/foood/src/Search.js:81-85`).

## Verification

Foood has no app-specific test script or existing test files
(`examples/foood/package.json`). The pure search module should receive unit tests
covering:

- a query with spaces matching a title without spaces, and the reverse;
- case and punctuation differences;
- one-character insertion/deletion and a common transposition;
- exact matches ranking ahead of fuzzy matches;
- closer fuzzy matches ranking ahead of weaker ones;
- multiple query words;
- title results excluded from the body group;
- an exact ingredient/instruction body match;
- trashed and current-actor rejected recipes excluded;
- recipes rejected by another actor remaining eligible;
- empty and whitespace-only queries;
- non-string Quill inserts being ignored;
- stable ordering when scores are equal; and
- special characters round-tripping through `?q=`.

Threshold tests should use behavioral expectations ("this result appears before
that one" or "this unrelated result is absent") rather than assert raw Fuse
scores, which are implementation details.

Manual verification should include the production Parcel build, several real
recipe queries on mobile and desktop, rapid typing through the debounce, browser
back/forward behavior, pagination across both sections, and a query with no
results.

## Open questions

- Should fuzzy matching apply only to titles for the first version, while recipe
  bodies retain exact/normalized substring matching? This is the recommended
  scope because fuzzy matching long bodies is more likely to produce surprising
  results.
    - yeah let's do that
- What does "proper fuzzy" need to tolerate beyond missing spaces: spelling
  errors, transposed letters, out-of-order words, abbreviations, or all of these?
  Representative queries and expected titles would make threshold tuning
  concrete.
    - fuse looks good
- Should relevance fully replace the current favorite/approved/update ordering,
  or should recipe status influence similarly scored matches? The recommendation
  is relevance first and the current order only as a tie-breaker.
    - yeah we still want to bin by recipe status
- Should one- and two-character queries use fuzzy matching? The recommendation is
  exact/compact-only until the query has at least three characters.
    - sounds good
- Should diacritics be folded (`crème` matching `creme`) in addition to removing
  whitespace and punctuation? Unicode normalization makes this inexpensive, but
  the desired international behavior should be explicit.
    - yes please
- Should the two visible sections remain `Title match` and `Contents match`, or
  should all results be merged into one relevance-ranked list?
    - yes keep that
- If fuzzy body search is enabled, how permissive should it be, and should the UI
  show a matching snippet so users can understand why a recipe appeared?
    - not enabled
- Should source, author, tags, or structured recipe metadata also be searchable?
  The historical Fuse implementation included source, but the current task only
  calls out titles and possibly recipe bodies.
    - no
- Should rejected recipes remain hidden from search? This is current behavior and
  should be preserved unless search is expected to recover rejected recipes.
    - hide
