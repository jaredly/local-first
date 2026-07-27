# Authenticated JSON-LD import plan

## Goal

Replace Foood's use of the public `get-page` Cloudflare Worker with an
authenticated endpoint on the existing general server:

```text
GET https://logic.jaredforsyth.com/api/json-ld?url=<encoded source URL>
Authorization: Bearer: <Foood session token>
```

The endpoint will fetch a public HTML page and return only its valid
`application/ld+json` payloads. It will never return the page HTML, arbitrary
upstream headers, or other response content.

Foood will inspect the returned JSON-LD for Recipe objects:

- zero recipes produces a visible error;
- one recipe imports immediately; and
- multiple recipes open a chooser before modifying the editor.

The endpoint shares Foood's existing session authentication. It must also enforce
SSRF protection and bounded work so recipe imports cannot threaten the general
server's sync, auth, or persistence responsibilities.

## Settled behavior

- The endpoint lives in `general-server`, not a Cloudflare Worker.
- Production API host: `https://logic.jaredforsyth.com`.
- Production Foood origin: `https://foood.jaredforsyth.com`.
- Local Foood origins may use any port on `localhost`, `127.0.0.1`, or `[::1]`.
- The existing Foood session token is required in the `Authorization` header.
- The response is a JSON-LD proxy response, not an HTML proxy response.
- The response contains all successfully parsed JSON-LD script payloads in
  document order.
- Malformed JSON-LD blocks are skipped when at least one other block is valid.
- Foood extracts all Recipe objects from the returned payloads.
- One recipe imports directly; multiple recipes require a user selection.
- Import failures are visible in the recipe editor.
- Rate limit: 100 authenticated import attempts per user per 10 minutes.
- Concurrency limit: two active imports per user and an initial global ceiling of
  eight active imports.
- Initial network limits: 2 MiB decoded HTML, three redirects, and a 10-second
  overall deadline.
- Production runs one general-server process, so an in-memory rate limiter and
  concurrency tracker are sufficient for the first version.
- A maintained SSRF/network filtering dependency is acceptable.
- The general server may be upgraded to Node 24 LTS.
- Client-side browser rendering and anti-bot circumvention are out of scope.
- URL import will not fall back to the old public Worker. If memory mode is made
  usable again, URL import will be disabled there until it has an authenticated
  server configuration.

## Response contract

### Success

Return:

```json
{
  "jsonLd": [
    {
      "@context": "https://schema.org",
      "@type": "Recipe",
      "name": "Example"
    }
  ]
}
```

`jsonLd` contains parsed JSON values, not raw script strings. A payload may be an
object, array, primitive, or null if that is what a valid JSON-LD script contains;
the Foood traversal code must safely ignore values that cannot contain a Recipe.

Use:

```http
Content-Type: application/json; charset=utf-8
Cache-Control: private, no-store
Vary: Origin
```

Do not include the requested URL, redirect chain, resolved addresses, page HTML,
or upstream response headers.

### Errors

Return a stable JSON body:

```json
{ "error": "recipe_page_too_large" }
```

Use these initial codes and statuses:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_url` | Missing, malformed, or disallowed URL |
| 401 | existing auth response | Missing, expired, or invalid session |
| 403 | `origin_not_allowed` | Browser origin is outside the allowlist |
| 404 | `json_ld_not_found` | HTML contains no JSON-LD scripts |
| 405 | `method_not_allowed` | Unsupported HTTP method |
| 413 | `recipe_page_too_large` | Declared or streamed page exceeds the cap |
| 415 | `unsupported_content_type` | Upstream response is not HTML/XHTML |
| 422 | `invalid_json_ld` | Scripts exist but none parse successfully |
| 429 | `rate_limited` | Per-user rate or concurrency limit exceeded |
| 502 | `upstream_error` | DNS, connection, redirect, or upstream HTTP failure |
| 504 | `upstream_timeout` | Overall deadline expired |

Include `Retry-After` for rate and concurrency rejection where a useful value is
known. Do not return raw exceptions or upstream bodies.

## Phase 1: Upgrade and verify the general-server runtime

### Move the declared runtime to Node 24

Update:

- `examples/general-server/.nvmrc` to the selected Node 24 release line;
- `examples/general-server/package.json` to require Node 24; and
- deployment documentation/configuration that selects the production runtime.

The current `.nvmrc` is Node 13, which does not provide the runtime APIs expected
by this implementation and has long been unsupported.

### Update native and HTTP/parser dependencies

Upgrade both declarations of `better-sqlite3` to the same Node-24-compatible
version:

- `packages/server-bundle/package.json`;
- `packages/auth/package.json`.

They must remain identical because `monorepo-pack` rejects conflicting dependency
versions when it creates the deployable general-server package.

Add direct general-server dependencies for:

- an HTML parser, preferably current Cheerio on Node 24;
- Undici, so the outbound client can use an explicit dispatcher/agent;
- an IP-address parser/classifier such as `ipaddr.js`; and
- a maintained request-filtering agent if it provides stronger destination
  pinning than a small custom Undici lookup.

The implementation must not rely on a transitive parser or HTTP package.

Update `examples/general-server/yarn.lock` and any package lockfiles affected by
the shared `better-sqlite3` upgrade. Do not modify Foood's browser dependency on
Cheerio unless it becomes unused after the client migration.

### Prove the runtime upgrade independently

Before adding the endpoint:

1. Install dependencies under Node 24.
2. Start general-server against a disposable data directory.
3. Create or use a test user.
4. Verify login, `/api/user`, logout, public/private database access, polling,
   websocket setup, and SQLite reads/writes.
5. Run `node pack.js general-server`.
6. Install and start the generated deployable package.

Treat native SQLite compatibility, Babel startup, or packer failures as Phase 1
blockers. Do not combine diagnosis of a runtime migration failure with the new
network endpoint.

## Phase 2: Add the authenticated, bounded JSON-LD endpoint

### Expose the existing auth middleware

Update `packages/server-bundle/full.js`:

1. Create one named `authMiddleware` from the existing auth database and secret.
2. Reuse it for the existing `/dbs/` mount.
3. Return it from `runMulti2` alongside `app`:

   ```js
   return { app, authMiddleware };
   ```

This extends the return value without breaking its only current caller.

In `examples/general-server/glitch.js`, register the JSON-LD route with the
returned middleware. Keep the recipe-specific route out of
`packages/server-bundle`; other server-bundle consumers do not need it.

### Create a focused import module

Add `examples/general-server/recipe-import.js` with a setup API such as:

```js
setupRecipeImport(app, authMiddleware, options)
```

Separate the module internally into testable concerns:

- target URL parsing;
- origin validation;
- public-destination DNS/SSRF validation;
- bounded redirect fetching;
- bounded response-body reading;
- JSON-LD extraction;
- rate/concurrency accounting;
- error normalization; and
- Express route wiring.

Allow tests to inject DNS resolution, time, and the outbound client. Production
defaults should be constructed in `setupRecipeImport`.

### Enforce authentication before work

Install the existing auth middleware before URL validation, DNS, rate counting,
or any outbound request. Use `req.auth.id` as the rate/concurrency key.

The client must send:

```text
Authorization: Bearer: <token>
```

Preserve this existing non-standard header syntax for this task. Do not accept
the token in the target URL or reflect it into outbound headers.

### Add route-specific origin policy

Allow requests with:

- `Origin: https://foood.jaredforsyth.com`;
- a local HTTP or HTTPS origin whose hostname is `localhost`, `127.0.0.1`, or
  `[::1]`, with any valid port; or
- no `Origin` header, for authenticated CLI/manual diagnosis.

Reject other browser origins with `403 origin_not_allowed`.

`setupExpress` currently installs permissive global CORS before application
routes. The route-specific guard must remove or overwrite the global
`Access-Control-Allow-Origin` header before sending a disallowed response. On
allowed responses, set the exact request origin and `Vary: Origin`.

The global CORS middleware currently answers preflight before later routes.
Verify that an `Authorization` preflight succeeds for the supported origins.
The actual authenticated `GET` remains authoritative: a permissive preflight
must not cause a disallowed origin to receive a readable GET response.

Avoid changing global CORS behavior for all endpoints in this task unless tests
show route-local enforcement cannot be made correct.

### Validate every URL and redirect

Accept only absolute `http:` and `https:` URLs with:

- no username or password;
- a non-empty hostname;
- only the default protocol port;
- a bounded serialized length; and
- a hostname other than `logic.jaredforsyth.com` and the server's configured
  aliases.

Reject localhost-style names before DNS. For each initial target and redirect:

1. Resolve all IPv4 and IPv6 results.
2. Parse every address with the selected IP library.
3. Reject the target if any result is loopback, private, link-local, multicast,
   unspecified, reserved, or otherwise non-public.
4. Ensure the HTTP connection uses an address from that validated lookup rather
   than performing an uncontrolled second DNS resolution.
5. Resolve relative `Location` headers against the current URL.
6. Repeat all checks before following a redirect.

Use `redirect: "manual"` and follow at most three standard HTTP redirects.
Reject redirect loops, missing/invalid locations, and non-HTTP destinations.

Add tests proving private IPv4, private IPv6, mixed public/private DNS results,
redirects to private destinations, and DNS rebinding cannot bypass the check.

### Bound outbound work

Use one overall abort deadline of 10 seconds covering DNS, redirects, headers,
body download, parsing, and JSON serialization.

For an upstream response:

1. Require a successful 2xx status.
2. Require `text/html` or `application/xhtml+xml`.
3. Reject a declared `Content-Length` above 2 MiB.
4. Read the response body incrementally.
5. Count decoded bytes and abort immediately above 2 MiB.
6. Cancel/destroy all rejected or abandoned response bodies.

Send only purpose-built outbound headers:

```text
Accept: text/html, application/xhtml+xml
User-Agent: Foood recipe importer/<version>
```

Never forward authentication, cookies, referrer, client IP, or arbitrary request
headers.

### Extract JSON-LD

Parse the bounded HTML with Cheerio and inspect `script[type]` elements in
document order.

For each script:

1. Normalize the MIME type case-insensitively.
2. Ignore whitespace and optional `;` parameters.
3. Process only `application/ld+json`.
4. Reject an individual script above 512 KiB.
5. Parse it independently with `JSON.parse`.
6. Append successful values to `jsonLd`.

Track whether matching scripts existed:

- no matching script -> `404 json_ld_not_found`;
- matching scripts but no valid parsed value -> `422 invalid_json_ld`;
- one or more valid values -> `200`, even if other blocks were malformed.

Do not traverse for Recipe objects on the server. The endpoint contract is
JSON-LD extraction, while Foood owns Recipe selection.

### Add rate and concurrency controls

Use bounded in-memory maps keyed by `req.auth.id`.

Rate limit:

- 100 attempts;
- rolling or fixed 10-minute window;
- count after authentication and basic URL validation, immediately before DNS or
  fetch;
- periodically remove expired user entries so the map cannot grow forever.

Concurrency:

- at most two active imports for one user;
- at most eight active imports across the process;
- acquire before DNS/fetch;
- release in `finally` on every success, error, timeout, or disconnect.

Return `429` without starting an outbound request when either limit is exceeded.
The rate limit resets on process restart by design.

### Add safe server diagnostics

Log structured fields sufficient to diagnose behavior:

- authenticated user ID;
- outcome/error code;
- elapsed time;
- upstream status;
- redirect count;
- bytes read;
- number of matching scripts; and
- number of parsed JSON-LD payloads.

Do not log tokens, complete target URLs, query strings, response bodies, or JSON-LD
contents. A normalized target hostname is acceptable if operationally useful.

## Phase 3: Migrate Foood and add recipe selection

### Replace urlImport's transport

Update `examples/foood/src/urlImport.js` to export an authenticated client such
as:

```js
urlImport(sourceUrl, serverUrl, token): Promise<Array<RecipeJsonLd>>
```

It should:

1. request `/api/json-ld?url=<encoded URL>`;
2. send the existing `Authorization: Bearer: <token>` header;
3. require a successful response;
4. validate that the response is an object with a `jsonLd` array;
5. find every Recipe object in those payloads; and
6. return candidates in document/traversal order.

Replace `findOfType` with a null-safe, bounded `findAllOfType` that supports:

- direct `@type: "Recipe"`;
- `@type` arrays containing `Recipe`;
- top-level arrays;
- `@graph` on any object; and
- nested arrays and objects.

Use a visited-object set, a 10,000-value traversal limit, and a depth limit of 64.
Deduplicate the same object reference during traversal. When separate payloads
contain the same non-empty `@id`, keep only the first candidate for that `@id`.
Do not guess that recipes with the same name are duplicates.

Map server error codes to stable client errors suitable for visible messages.
Do not expose raw server response text in the UI.

Keep or separately refactor the exported `findImage` behavior; it can inspect
`ImageObject`, `WebPage`, and `Article` values and must not be removed merely
because Recipe discovery changes.

### Inject authenticated importing into editors

In `examples/foood/src/App.js`, build:

```js
const importRecipe = source =>
    urlImport(source, url, config.authData.auth.token);
```

only for remote authenticated mode.

Pass `importRecipe` through:

- the new-recipe `Editor` route;
- `EditorView`; and
- `EditorView`'s `Editor`.

Prefer passing the function rather than passing the raw session token into the
editor component. The transport module and `App` retain responsibility for auth
and server addressing.

If `importRecipe` is absent, disable the Import button and do not auto-import a
`?url=`/shared-text URL. Show a concise unavailable message if an automatic
import was requested. Never fall back to `get-page`.

### Separate candidate retrieval from application

Refactor `Editor.js`:

- `doImport(source)` owns request/loading/error/candidate state;
- `applyImportedRecipe(recipe)` owns the existing title, yield, image, time,
  ingredients, instructions, and editor-content updates.

This prevents selecting from multiple results from re-fetching the source page.

Add state for:

```js
{
    status: 'idle' | 'loading' | 'choosing' | 'error',
    candidates: Array<RecipeJsonLd>,
    error: ?string,
}
```

Behavior:

- Clear the previous import error when starting a new attempt.
- Disable the Import button while loading.
- Preserve all editor content until one candidate has been selected and applied.
- Zero candidates -> visible "No recipes found in this page's JSON-LD."
- One candidate -> call `applyImportedRecipe` immediately.
- Multiple candidates -> open the chooser.
- Closing the chooser without selection leaves editor data unchanged.
- Selecting a candidate applies it once and closes the chooser.
- A later import attempt replaces stale candidates and errors.
- Ignore or abort a stale response if a newer import attempt has begun or the
  editor has unmounted.

### Add the recipe chooser

Use the existing Material UI `Dialog` components.

Each option should show:

- `name`, falling back to `Recipe 1`, `Recipe 2`, and so on;
- author when present;
- yield when present; and
- a small image only when the existing `getImage` helper resolves one.

Render candidates as a selectable list, not nested cards. Include a Cancel
command. The dialog must work on narrow mobile screens and with keyboard focus.

### Add visible errors

Render a Material UI `Alert` adjacent to the Source/Import controls for:

- authentication expired;
- origin rejected;
- rate limit reached;
- timeout;
- page too large;
- unsupported page type;
- upstream fetch failure;
- no JSON-LD;
- invalid JSON-LD;
- no Recipe objects; and
- malformed server response.

Use user-facing messages rather than internal codes. Keep the source URL and
existing editor fields intact after errors.

Remove the current `console.log("Found!")`, recipe payload logging, and
console-only rejection behavior.

## Phase 4: Add focused automated coverage

### General-server tests

Use Node 24's test runner or the smallest repository-compatible harness. Keep the
network layer injectable so tests do not use public DNS or real recipe sites.

Cover:

- authentication runs before URL validation or outbound work;
- valid and invalid session behavior at the route boundary;
- production, local-any-port, disallowed, and absent Origin headers;
- disallowed responses do not retain permissive global CORS headers;
- malformed, relative, credentialed, non-HTTP, non-default-port, local-hostname,
  private-IP, and self-referential URLs;
- public DNS, private IPv4/IPv6, mixed public/private results, and pinned lookup;
- every redirect case and the three-redirect limit;
- timeout before headers, during redirects, and during body reading;
- non-2xx, non-HTML, declared oversize, streamed oversize, and truncated bodies;
- matching MIME type case/parameters;
- one, multiple, malformed-only, mixed malformed/valid, and missing JSON-LD
  blocks;
- success response ordering and shape;
- no upstream data or secrets in errors;
- 100 requests accepted and the next rejected inside the window;
- window expiry;
- two per-user imports allowed and the third rejected;
- eight global imports allowed and the next rejected;
- counters released after success, failure, timeout, and client disconnect; and
- expired rate entries are cleaned up.

Use small invented HTML fixtures. Do not check in copied recipe pages.

### Foood unit tests

Add tests around the pure JSON-LD traversal and response handling:

- direct Recipe;
- Recipe in an array or `@graph`;
- `@type` array;
- deeply nested Recipe;
- nulls and primitives;
- multiple Recipe objects preserve order;
- duplicate object and duplicate `@id` behavior;
- traversal depth/node limits;
- no Recipe;
- invalid response shape;
- each server error code maps to the expected client error.

Extract editor import state transitions into pure helpers where practical, or add
focused component coverage for:

- one result applying immediately;
- multiple results opening the chooser;
- selecting and canceling;
- loading and disabled controls;
- visible error rendering;
- stale requests ignored; and
- editor fields unchanged until selection.

## Phase 5: Build, integration, and deployment

### Static and build checks

- Run general-server tests under Node 24.
- Run Foood tests.
- Run Flow checks for touched packages where available.
- Run the Foood production Parcel build.
- Run `node pack.js general-server`.
- Install/start the packed server artifact.
- Run `git diff --check`.

Inspect generated package metadata to confirm the production artifact contains
the selected HTTP, parser, SSRF, IP, and upgraded SQLite dependencies.

### Local integration

With general-server on `localhost:9090` and Foood on at least two different local
ports:

1. Log in and verify ordinary sync.
2. Import a page with one recipe.
3. Import a fixture/page with multiple recipes and choose each option.
4. Cancel the chooser and verify fields remain unchanged.
5. Exercise each visible error state using controlled upstream fixtures.
6. Verify a logged-out request returns `401` without DNS/fetch.
7. Verify a disallowed browser origin cannot read the result.
8. Verify local origins work regardless of port.
9. Verify server sync remains responsive during eight slow imports.
10. Verify no request reaches `get-page.jaredly.workers.dev`.

### Production rollout

Deploy in this order:

1. Back up the general-server data directory.
2. Deploy the Node 24/runtime and SQLite dependency upgrade without enabling the
   new Foood client.
3. Verify auth, sync, websockets, public recipes, uploads, backups, and server
   health.
4. Deploy the authenticated `/api/json-ld` endpoint.
5. Test it directly with a valid production Foood session and safe recipe URLs.
6. Deploy Foood configured for `logic.jaredforsyth.com`.
7. Verify one-recipe, multiple-recipe, no-recipe, and error flows from
   `https://foood.jaredforsyth.com`.
8. Observe memory, event-loop delay, error rate, timeouts, rate rejection, and
   import duration.
9. Disable/delete the old `get-page` Worker.
10. Confirm the old hostname no longer returns arbitrary HTML.

Keep a rollback path for the Node/native SQLite upgrade. Do not roll the Foood
client back to the public proxy; if the endpoint must be disabled, leave URL
import visibly unavailable until the server issue is fixed.

## Completion criteria

The task is complete when:

- an anonymous caller cannot cause an outbound import fetch;
- an authenticated Foood user can import JSON-LD through general-server;
- only valid parsed JSON-LD leaves the server;
- private/local network targets and redirect escapes are rejected;
- timeout, size, redirect, rate, and concurrency limits are enforced;
- one Recipe imports directly;
- multiple Recipes require and honor a user selection;
- all expected failures are visible without destroying editor state;
- general-server auth, SQLite, sync, websocket, upload, backup, and public-read
  behavior still work under Node 24;
- the packed deployment includes every runtime dependency;
- production Foood no longer calls `get-page`; and
- the old generic proxy is disabled.
