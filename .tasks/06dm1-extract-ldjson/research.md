# Authenticated recipe import in general-server

## Summary

Yes. `general-server` already owns Foood's user database, session validation, and
production hostname, so it is a better home for recipe importing than a separate
Cloudflare Worker.

The recommended endpoint is not a generic CORS proxy. It should be a narrow,
authenticated recipe extraction endpoint:

```text
GET /api/recipe-from-url?url=https%3A%2F%2Fexample.com%2Frecipe
Authorization: Bearer: <existing Foood session token>
```

It should fetch the target page on the server, find the first JSON-LD object
whose `@type` includes `Recipe`, and return only that object. It must never return
arbitrary HTML or arbitrary upstream headers.

This has three advantages over both the old `get-page` proxy and the proposed
Worker:

- existing Foood sessions prevent anonymous bot use;
- returning only Recipe JSON-LD avoids retaining a general-purpose proxy
  capability; and
- there is no second deployment, hostname, rate-limiting system, or auth
  integration to operate.

Authentication does not remove the need for URL validation, SSRF protection,
timeouts, download limits, concurrency limits, and per-user throttling. This
server also handles Foood synchronization and persistence, so an unbounded
outbound fetch would put the primary application at risk.

## Existing server and authentication

### general-server owns Foood

`examples/general-server/glitch.js:11-22` starts `runMulti2` with both the
`foood` and `foood-private` schemas. Production Foood points at
`logic.jaredforsyth.com`, while local development points at `localhost:9090`
(`examples/foood/src/index.js:123-127`).

`runMulti2`:

- requires the server `SECRET`;
- opens `.data/store/users.db`;
- creates the Express application;
- installs auth middleware on `/dbs/*`;
- installs `/api/login`, `/api/logout`, `/api/user`, and related auth routes; and
- returns the Express application

(`packages/server-bundle/full.js:77-95`, `:146`, `:325-328`).

The recipe endpoint therefore belongs in `examples/general-server`, where it can
be enabled for this deployment without adding recipe-specific behavior to every
consumer of `packages/server-bundle`.

### Foood already has the required token

Login and signup return a signed session token in `X-Session`. The browser stores
it under `foood/auth` and uses it for subsequent requests
(`examples/shared/auth-api.js:55-70`).

The auth middleware accepts either:

- the `token` query parameter; or
- `Authorization: Bearer: <token>`

(`packages/auth/index.js:128-169`).

Foood already uses the header form for `/api/user` and `/api/logout`
(`examples/shared/auth-api.js:74-103`). The recipe-import request should do the
same. Although `Bearer:` is non-standard syntax, it is the existing contract;
changing all auth callers to standard `Bearer <token>` is a separate cleanup.

Session validation verifies the JWT, loads the referenced SQLite session,
rejects logged-out or expired sessions, and loads the user
(`packages/auth/db.js:233-274`). A successful middleware call puts the user and
session on `req.auth`, giving the endpoint a stable user ID for throttling and
logging.

### Small server-bundle hook needed

`runMulti2` currently creates its auth database and middleware internally but
returns only `{ app }`. Reopening the same auth database from `glitch.js` would
work, but it creates a second database handle and duplicates setup knowledge.

The cleaner change is:

1. Create `authMiddleware` once inside `runMulti2`.
2. Use it for the existing `/dbs/` mount.
3. Return `{ app, authMiddleware }`.
4. Register the recipe route in `glitch.js` with that middleware.

There is only one `runMulti2` caller in this repository, so extending its return
value is low risk and backward compatible.

Express permits adding routes after `listen()`, which `glitch.js` already does
for `/`, backups, and uploads. A cleaner long-term shape would register all
application routes before listening, but that refactor is not required here.

Suggested registration:

```js
const setupRecipeImport = require('./recipe-import');
setupRecipeImport(result.app, result.authMiddleware);
```

The module can then install:

```js
app.get('/api/recipe-from-url', authMiddleware, handler);
```

## Why not a basic HTML proxy

An authenticated generic proxy would be less exposed than `get-page`, but it
would still:

- allow any valid or stolen Foood token to retrieve arbitrary pages through the
  server;
- make SSRF results available to the caller;
- transfer much larger responses through the server;
- leave parsing behavior split between server and browser; and
- require maintaining CORS-proxy semantics that Foood does not need.

Extracting the recipe on the server is only a modest addition because the page
must already be downloaded there. The narrow response is the more defensible API:

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Example",
  "recipeIngredient": []
}
```

If keeping the current client-side parser is important for the smallest possible
first patch, an authenticated HTML-returning endpoint is technically viable.
It should be treated as a temporary implementation and still receive every
network/resource restriction described below.

## Endpoint contract

### Request

Support only:

```text
GET /api/recipe-from-url?url=<absolute URL>
OPTIONS /api/recipe-from-url
```

The existing global Express CORS middleware handles preflight. Require the
existing session token in the `Authorization` header. Do not put the token in the
query string because query strings are more likely to appear in access logs and
caches.

Validate the target with `new URL()` and require:

- `http:` or `https:`;
- no username or password;
- a non-empty hostname;
- preferably only default HTTP/HTTPS ports;
- no localhost or local-only hostname; and
- a serialized URL below a small fixed length.

Do not forward the inbound `Authorization` header, cookies, user agent, referrer,
or any other caller headers. Construct a new outbound `GET` with only an explicit
recipe-import `User-Agent` and an HTML `Accept` header.

### Response

On success:

```http
HTTP/1.1 200 OK
Content-Type: application/ld+json; charset=utf-8
Cache-Control: private, no-store

{"@context":"https://schema.org","@type":"Recipe", ...}
```

Recommended JSON errors:

- `400 invalid_url`;
- `401` from the existing auth middleware;
- `404 recipe_not_found`;
- `405 method_not_allowed`;
- `413 response_too_large`;
- `415 unsupported_content_type`;
- `422 invalid_json_ld` when JSON-LD exists but every block is malformed;
- `429 rate_limited`;
- `502 upstream_error`; and
- `504 upstream_timeout`.

Do not return upstream bodies, exception messages, resolved IPs, or full target
URLs in errors.

## Fetching and SSRF

Authentication changes who can invoke the endpoint; it does not make arbitrary
server-side URLs safe. A valid user could accidentally or deliberately target
services reachable only from the server, and a stolen token could be used the
same way.

For every initial target and redirect:

1. Parse and validate the URL.
2. Resolve the hostname.
3. Reject every loopback, private, link-local, multicast, unspecified, reserved,
   or otherwise non-public IPv4/IPv6 address.
4. Connect using a validated resolution rather than resolving a second time
   later, which would leave a DNS-rebinding window.
5. Follow at most a small fixed number of redirects.
6. Re-run validation and resolution for every redirect target.
7. Reject the general server's own hostname to avoid self-recursion.

IPv6 classification is easy to get subtly wrong. Use a maintained IP-address
classification library or a proven request-filtering agent rather than a few
regular expressions. URL string checks alone are insufficient because a public
hostname can resolve to a private address.

Also enforce:

- roughly a 10-second overall deadline;
- a 2 MiB decoded-body limit as a starting point;
- a declared `Content-Length` pre-check plus a streamed byte counter;
- only successful HTML/XHTML upstream responses;
- at most three redirects;
- at most two concurrent imports per user;
- a small global import concurrency ceiling; and
- a per-user request budget, for example 20 attempts per 10 minutes.

The exact limits should be configurable and tuned from observed use. Rate
limiting can start as a bounded in-memory map because `general-server` is one
process. It is not exact across multiple replicas and resets on restart, which is
acceptable for an initial abuse guard but should be documented.

Cancel or destroy the outbound request as soon as a timeout, size limit, invalid
redirect, or unsupported content type is known. Never stream the upstream body
to the Foood client.

## Runtime and parsing

### Node version is a prerequisite decision

`examples/general-server/.nvmrc` contains Node 13 and `package.json` declares
`node >=12`. Neither provides the current built-in Fetch API, and both release
lines have been end-of-life for years. The server has no declared `node-fetch`,
Undici, Cheerio, or other outbound-page dependency.

The preferred prerequisite is to move this deployment to Node 24 LTS, update the
engine and `.nvmrc`, and verify the server before adding imports. Node's release
policy recommends production use of supported LTS lines; as of July 2026, Node
24 is LTS through April 2028, while Node 13 reached EOL in April 2020. See
[Node.js releases](https://nodejs.org/en/about/previous-releases) and the
[Node 22 to 24 migration guide](https://nodejs.org/en/blog/migrations/v22-to-v24).

Node 24 provides stable `fetch`, `AbortController`, and `AbortSignal.timeout`.
However, built-in fetch does not by itself solve destination-address validation;
the implementation still needs a dispatcher/agent or controlled HTTP client
that pins a validated DNS result.

If the runtime cannot be upgraded in this task, add explicit HTTP and parser
dependencies compatible with the deployed Node version. Do not rely on hoisted
transitive packages: the monorepo packer derives the deployment from declared
package dependencies.

### HTML and JSON-LD parsing

Use a real HTML parser, not a regular expression. Cheerio is already familiar in
the Foood repository, but it is only declared by the browser project, not
`general-server`. Add the chosen parser as a direct server dependency and pin a
version compatible with the selected Node runtime.

For each `script` element:

1. Normalize the `type` value case-insensitively and ignore optional MIME
   parameters.
2. Process only `application/ld+json`.
3. Enforce a per-script limit, suggested 512 KiB.
4. Parse each block independently so malformed metadata does not hide a later
   valid recipe.
5. Traverse parsed arrays and objects for the first Recipe.

Recipe detection should support:

- `@type: "Recipe"`;
- `@type: ["Thing", "Recipe"]`;
- top-level arrays;
- `@graph` at any object level; and
- nested objects/arrays.

Bound traversal by node count and depth. A reasonable starting point is 10,000
visited values and 64 levels.

The current client traversal in `examples/foood/src/urlImport.js:82-104` does not
handle `@type` arrays, skips some `@graph` values, and assumes non-null objects.
Moving extraction server-side is a good opportunity to make this behavior
explicit and testable.

## CORS behavior

`setupExpress` currently installs:

```js
cors({ origin: true, exposedHeaders: ['etag', 'X-Session'] })
```

for the entire application (`packages/server-bundle/index.js:80-86`). It reflects
any request origin, so the new endpoint is already cross-origin accessible.
Foood can send its `Authorization` header from `foood2.surge.sh` to
`logic.jaredforsyth.com`.

Authentication remains the actual access control. A hostile web page cannot read
Foood's localStorage token across origins, but permissive CORS is broader than
necessary and makes any future token leak more useful.

For this endpoint, explicitly allow the production Foood origin and local
development origins. Because global CORS middleware runs first, the handler or a
route-specific middleware must overwrite/remove its headers for disallowed
origins. A broader cleanup would replace global `origin: true` with an
application allowlist, but that has a larger compatibility surface and should
not be bundled into this narrow change without inventorying other clients.

## Foood client changes

`urlImport.js` currently calls the public Worker, downloads HTML, builds a
detached DOM, parses every JSON-LD script, and finds a Recipe
(`examples/foood/src/urlImport.js:3-28`).

Change it to accept the server base URL and auth token:

```js
urlImport(sourceUrl, serverUrl, token)
```

It should request:

```js
fetch(`${serverUrl}/api/recipe-from-url?url=${encodeURIComponent(sourceUrl)}`, {
    headers: {
        Authorization: `Bearer: ${token}`,
    },
});
```

Then check `res.ok`, parse the JSON response, and return it directly. Remove the
browser HTML parsing from the import path.

`App` already has both values:

- `url` is the protocol-qualified general-server base URL
  (`examples/foood/src/App.js:110-115`);
- `authData.auth.token` is the session token.

The token must be passed through both new-recipe and edit-recipe paths:

- `App -> Editor` at `examples/foood/src/App.js:180-218`;
- `App -> EditorView` at `examples/foood/src/App.js:289-295`; and
- `EditorView -> Editor` at `examples/foood/src/EditorView.js:32-92`.

Passing an `importRecipe` function is cleaner than threading a raw token through
the editor:

```js
const importRecipe = source => urlImport(source, url, authData.auth.token);
```

`Editor` can then call the injected function. This keeps authentication and
server addressing outside the presentational editor and makes import behavior
easy to test.

Memory-mode Foood currently has no authenticated general server. Decide whether
URL import should be unavailable there or use a deliberately configured
development server. It should not silently fall back to the old public proxy.

The exported `findImage` helper still uses `findOfType`, so removing the import
parser should not blindly delete that function. Search and test its independent
image-discovery behavior first.

## Suggested files

```text
examples/general-server/
  glitch.js
  recipe-import.js
  recipe-import.test.js
  package.json

packages/server-bundle/
  full.js

examples/foood/src/
  App.js
  Editor.js
  EditorView.js
  urlImport.js
```

Keep route/auth wiring in `glitch.js`, HTTP policy and extraction in
`recipe-import.js`, and the generic auth hook in `server-bundle/full.js`.

## Verification

### Server tests

- missing, malformed, relative, credentialed, non-HTTP, local, private-IP,
  non-default-port, and self-referential URLs;
- public DNS resolving to private IPv4 or IPv6;
- DNS-rebinding-resistant connection behavior;
- redirects: relative, cross-host, loop, missing location, private destination,
  and over limit;
- missing, invalid, expired, and logged-out session tokens;
- authenticated request exposes `req.auth.id` to throttling;
- upstream timeout, connection failure, non-2xx, non-HTML, declared oversize,
  streamed oversize, and truncated body;
- direct Recipe, arrays, `@graph`, `@type` arrays, nested Recipe, malformed block
  followed by valid block, multiple recipes, and no recipe;
- page, script, traversal-depth, and traversal-node limits;
- per-user rate and concurrency limits plus the global concurrency limit;
- disallowed CORS origins cannot read responses;
- errors do not expose bodies, secrets, stack traces, or complete target URLs.

Tests should inject or locally fake the outbound request layer. They should not
depend on live recipe websites or public DNS.

### Integration checks

- login and `/api/user` continue working;
- database polling and websocket sync continue working;
- production and local Foood can import while authenticated;
- logged-out requests receive `401` before any outbound request starts;
- title, yield, image, times, ingredients, and instructions populate as before;
- memory mode has the explicitly chosen behavior;
- current public recipe pages and uploads are unaffected;
- general-server memory, event-loop delay, and error rate remain stable during
  several concurrent imports; and
- the old `get-page` Worker is disabled after the new client deploy is verified.

Use small invented HTML fixtures rather than checking copied recipe pages into
the repository. The three historical URLs in `urlImport.js` are useful manual
smoke tests, but external sites may move, block server traffic, or change markup.

## Deployment order

1. Confirm and, preferably, upgrade the production Node runtime.
2. Add the reusable auth middleware return value and server endpoint.
3. Deploy the server and test it directly with a valid Foood session.
4. Update Foood to call the authenticated endpoint.
5. Verify imports and server health in production.
6. Disable the old `get-page` Worker.
7. Confirm the old hostname no longer returns arbitrary HTML.

## Open questions

- Can `general-server` be upgraded to Node 24 LTS as part of this work? This is
  strongly recommended before choosing the HTTP/parser dependencies.
    - sure
- Do you want the endpoint to return only the Recipe object, as recommended, or
  temporarily return HTML to preserve browser-side parsing?
    - we can have it be a json-ld proxy
- What are the exact production Foood origins? The checkout references
  `foood2.surge.sh`, but the deploy script also appears able to publish elsewhere.
    - foood.jaredforsyth.com is the static site, and logic.jaredforsyth.com is the server
- Should local Foood origins be unrestricted by port, or explicitly enumerated?
    - unrestricted
- What should memory-mode Foood do when a URL import is requested?
    - idk
- Are two concurrent imports per user, a small global ceiling, 20 attempts per
  10 minutes, a 2 MiB page cap, three redirects, and a 10-second deadline
  appropriate for current usage?
    - we can do 100 attempts per 10 minutes. other than that it looks good
- Does production run one `general-server` process or multiple replicas? An
  in-memory limiter is only per process.
    - one single process
- Is a maintained SSRF-filtering HTTP agent acceptable as a dependency, or is
  there an existing reverse proxy/network policy that can enforce public-only
  destinations?
    - sure
- If a page contains multiple Recipe objects, should the first remain the
  selection rule, or should the UI eventually offer a choice?
    - let's offer a choice in the UI
- Should visible import error states be included? `Editor` currently silently
  ignores a missing recipe and logs rejected imports only to the console
  (`examples/foood/src/Editor.js:338-375`).
    - yes let's show visible error states
- Are there known recipe sites that require client-side JavaScript or block the
  general server's hosting network? The endpoint should not add browser
  rendering or anti-bot circumvention without a separate design review.
    - no
