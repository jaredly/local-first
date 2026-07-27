# Recipe JSON-LD extraction Worker

## Summary

The replacement should be a small standalone Wrangler project, recommended at
`examples/extract-recipe-ldjson-worker`, with one narrow endpoint:

```text
GET /?url=https%3A%2F%2Fexample.com%2Frecipe
```

For a successful request, the Worker should return the first parsed JSON-LD
object whose `@type` includes `Recipe`. It must never return the fetched HTML,
arbitrary response headers, or non-recipe JSON-LD. That removes the useful
generic CORS-proxy behavior of the old `get-page` Worker.

This narrowing is necessary but is not sufficient abuse protection. The Worker
still performs an unauthenticated server-side fetch selected by its caller, so it
can consume Worker requests, origin bandwidth, CPU, and memory. The first version
should also include:

- an allowlist of browser origins;
- a Cloudflare rate-limiting binding;
- strict URL and redirect validation;
- fetch timeout, redirect-count, response-size, JSON-LD-size, and traversal
  limits;
- explicit content-type and status checks;
- short-lived caching of successful results; and
- structured, sampled observability that does not log full target URLs.

The existing Foood client then becomes simpler: `urlImport.js` fetches and
returns the JSON response instead of downloading HTML into the browser, creating
a detached DOM, locating scripts, parsing each script, and traversing the result.

Cloudflare recommends `wrangler.jsonc` for new projects and requires at least a
name, entrypoint, and compatibility date. The project should use the ES module
Worker format, TypeScript, the current compatibility date at implementation
time, and Cloudflare's Vitest integration. See
[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/),
[compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/),
and [Workers testing](https://developers.cloudflare.com/workers/testing/).

## Current Foood behavior

The only `get-page` reference in the repository is
`examples/foood/src/urlImport.js:3`. Its request and parsing flow is:

1. Fetch `https://get-page.jaredly.workers.dev/?url=<encoded URL>`.
2. Read the complete response as text.
3. Assign that text to a detached `<div>` with `innerHTML`.
4. Select every `script[type="application/ld+json"]`.
5. Parse the scripts in order and return the first value for which
   `findOfType(data, "Recipe")` succeeds.

`findOfType` recognizes a direct `@type: "Recipe"`, arrays, and some `@graph`
documents (`examples/foood/src/urlImport.js:82-104`). It does not recognize an
`@type` array, only visits `@graph` when its parent has no `@type`, and assumes
every traversed value is a non-null object. A malformed JSON-LD block rejects the
whole import instead of allowing a later valid block to succeed.

`Editor` is the active consumer (`examples/foood/src/Editor.js:338-375`). It uses
the returned Schema.org fields directly: `name`, `recipeYield`, `image`,
`totalTime`, `cookTime`, `prepTime`, ingredients, and instructions. There is no
visible import error state: a missing recipe silently returns, while a rejection
is only written to the console.

There are comments with three historical test URLs at
`examples/foood/src/urlImport.js:109-116`, but no tests for URL importing. There
is no Wrangler configuration or Cloudflare Worker project in this checkout.

## Recommended endpoint contract

### Request

Support only:

```text
GET /?url=<absolute-http-or-https-url>
OPTIONS /
```

`GET` avoids a request body and preserves the current client call shape.
`OPTIONS` handles CORS preflight if headers are added later. Reject other paths
and methods rather than treating them as aliases.

Validate the target with `new URL()` and require:

- `http:` or `https:`;
- no username or password;
- a non-empty hostname;
- preferably only default HTTP/HTTPS ports;
- no `localhost`, `.localhost`, or obvious private/link-local/loopback IP
  literals; and
- a serialized URL below a small fixed length.

Do not forward caller headers, cookies, authorization, or referrer information.
Construct a new outbound `GET` with a recipe-import `User-Agent` (where the
runtime permits it), `Accept: text/html, application/xhtml+xml`, and a bounded
timeout.

Use `redirect: "manual"` and follow only a small number of `301`, `302`, `303`,
`307`, or `308` responses. Resolve each `Location` relative to the current URL
and run the same URL validation before the next fetch. Cloudflare notes that
redirect chains consume one subrequest per hop, and Worker-created fetches can
automatically follow redirects when `follow` is used. See
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and
the [Request API](https://developers.cloudflare.com/workers/runtime-apis/request/).

### Success response

Return the recipe object directly:

```http
HTTP/1.1 200 OK
Content-Type: application/ld+json; charset=utf-8
Cache-Control: private, max-age=0
Vary: Origin

{"@context":"https://schema.org","@type":"Recipe", ...}
```

Returning the object directly matches what `processRecipe` currently resolves
to. A wrapper such as `{ "recipe": ... }` would be more extensible but requires
an otherwise unnecessary response-shape concept.

All responses should include CORS headers only when the request `Origin` is in
the configured allowlist. CORS is a browser access control, not authentication:
a bot can call the Worker directly without sending an allowed origin.

### Error response

Use a stable JSON shape such as:

```json
{ "error": "recipe_not_found" }
```

Recommended statuses:

- `400 invalid_url` for a missing or invalid target;
- `403 origin_not_allowed` for a browser origin outside the allowlist;
- `404 recipe_not_found` when valid HTML has no valid Recipe JSON-LD;
- `405 method_not_allowed`;
- `413 response_too_large` when declared or streamed bytes exceed the cap;
- `415 unsupported_content_type` for a non-HTML upstream response;
- `422 invalid_json_ld` only if scripts exist but none can be parsed;
- `429 rate_limited`;
- `502 upstream_error` for non-success upstream responses and fetch failures; and
- `504 upstream_timeout`.

The client should distinguish these failures eventually, but it can initially
throw on any non-200 response and preserve the current console-error behavior.
Do not include upstream HTML, exception messages, or a reflected full URL in the
response.

## Extraction design

Use the Workers-native `HTMLRewriter`, not Cheerio. It avoids adding a server DOM
dependency and parses HTML using the runtime's streaming parser. Register a
handler for:

```css
script[type]
```

In the element callback, normalize the media type to lowercase, trim whitespace,
and ignore any `;` parameters before deciding whether to collect the element's
text. Text callbacks can receive one logical text node in multiple chunks, so
the handler must concatenate chunks until the script element is complete before
calling `JSON.parse`. This chunking behavior is explicit in the
[HTMLRewriter documentation](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/).

The simplest bounded implementation is:

1. Reject a response whose `Content-Length` exceeds the page cap.
2. Read the body stream while counting decoded bytes and cancel at the cap.
3. Feed the bounded HTML to `HTMLRewriter`.
4. Consume the transformed response so handlers execute.
5. Parse each bounded JSON-LD script independently; skip malformed blocks.
6. Traverse parsed values and return the first Recipe object.

Buffering a capped page is acceptable and substantially simpler to test than
coordinating early cancellation with `HTMLRewriter` callbacks. The cap is
important because Workers isolates have 128 MB of memory and buffering large
bodies can cause resource-limit failures. Cloudflare recommends streaming to
avoid unbounded memory use; here, streaming is used to enforce a small maximum
before parsing. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

A reasonable starting cap is 2 MiB of decoded HTML, with:

- at most 32 matching script elements;
- at most 512 KiB per JSON-LD script;
- at most 10,000 visited JSON values; and
- at most 64 levels of traversal.

Those values need validation against real recipe sites. They should be named
constants and covered by tests rather than hidden in parser control flow.

Recipe detection should handle:

- `@type: "Recipe"`;
- `@type: ["Thing", "Recipe"]`;
- top-level arrays;
- `@graph` arrays regardless of whether the containing object has an `@type`;
  and
- nested objects/arrays used by real publishers.

Traverse only own JSON values, guard nulls and primitives, and stop after the
node/depth budget. JSON produced by `JSON.parse` is acyclic, so a visited-object
set is optional but inexpensive defensive code. Do not require every Schema.org
recipe field: the current client already tolerates many missing optional fields.

If a page contains multiple Recipe objects, preserve current behavior and return
the first one in document/traversal order. Returning an array would require a UI
for choosing a recipe and is a separate feature.

## Abuse and security controls

### Narrow output is not authorization

The new response is far less useful as a proxy because callers cannot retrieve
the HTML. It can still be used to make Cloudflare fetch attacker-chosen public
URLs or repeatedly fetch expensive recipe pages. Rate limiting and hard work
budgets are therefore part of the core implementation, not optional deployment
polish.

Use a Workers rate-limiting binding before the upstream fetch. Cloudflare's
binding is fast but permissive/eventually consistent and local to a Cloudflare
location, so it is a cost-control layer rather than exact accounting. Cloudflare
also advises preferring a stable user/API identity over IP addresses because IPs
may be shared. See the
[Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Foood currently has no credential that this standalone Worker can validate. A
secret embedded in the browser bundle would not be a secret. Options, in
descending strength, are:

1. validate an existing Foood login token against the same auth authority;
2. place the endpoint behind a same-origin authenticated backend/service binding;
3. use Cloudflare Access if all legitimate users can satisfy its policy; or
4. keep it public, enforce an Origin allowlist for browser callers, and apply
   conservative rate/resource limits.

Option 4 is the smallest compatible change but still permits non-browser use.

### URL fetching and SSRF

Rejecting obvious private IP literals is useful input hygiene but not a complete
DNS-level SSRF defense because a hostname can resolve or later rebind to a
different address. A current compatibility date and
`global_fetch_strictly_public` make Worker global fetches route through the
public Cloudflare front door, including requests to the Worker's own zone. The
flag also changes same-zone recursion behavior, so self-targeting must be
explicitly rejected by hostname. See
[Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

At minimum, deny the Worker's own production/preview hostnames and enforce the
redirect limit. If stronger network-destination guarantees are required, that
needs a verified Cloudflare product/runtime control rather than relying only on
string classification in application code.

### Resource bounds

Apply all of the following:

- rate-limit before fetching;
- one fetch at a time and a small redirect limit;
- an abort timeout for every hop and preferably an overall deadline;
- page and JSON-LD byte limits;
- JSON traversal node/depth limits;
- no arbitrary outbound methods or forwarded headers;
- cancel response bodies that will not be consumed;
- cache only successful validated recipes, with a short TTL;
- do not cache transient errors or rate-limit responses; and
- set a low Wrangler subrequest limit as a backstop.

Successful extraction results are good cache candidates because public recipe
metadata changes infrequently. A 5-15 minute TTL is a reasonable start. Cache by
the normalized target URL, not by caller origin, while constructing CORS headers
after the cache read so one origin's header cannot leak to another.

### Deployment exposure and observability

Prefer a custom domain or route and disable unused `workers.dev` and preview
routes. Cloudflare recommends a production route/custom domain rather than
`workers.dev`; `workers_dev: false` prevents a later deploy from re-enabling it.
See [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

Enable sampled Workers Logs. Record only:

- outcome/error code;
- total duration;
- upstream status;
- redirect count;
- bytes read;
- number of JSON-LD blocks examined; and
- a hostname or one-way hash if domain-level diagnosis is needed.

Do not log complete URLs because paths and query strings can contain user data.
Cloudflare supports observability and head sampling in Wrangler configuration;
see [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Project shape

Recommended files:

```text
examples/extract-recipe-ldjson-worker/
  package.json
  wrangler.jsonc
  tsconfig.json
  src/
    index.ts
    extract.ts
    response.ts
  test/
    extract.test.ts
    worker.test.ts
  fixtures/
    direct-recipe.html
    graph-recipe.html
    malformed-then-valid.html
    no-recipe.html
  vitest.config.ts
```

`index.ts` should own HTTP/CORS/rate-limit/cache/origin-fetch behavior.
`extract.ts` should own HTML extraction and bounded Recipe traversal.
`response.ts` can centralize JSON responses so success and every error receive
consistent security and CORS headers.

Keep this project independent from the old root Yarn dependency graph. Use only
development dependencies needed by Wrangler, TypeScript, Vitest, and
`@cloudflare/vitest-pool-workers`; the runtime implementation needs no npm
dependency. Generate Worker binding types from the Wrangler configuration rather
than maintaining a handwritten environment interface.

Example Wrangler concerns, with final values still to be chosen:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "extract-recipe-ldjson",
  "main": "src/index.ts",
  "compatibility_date": "<implementation date>",
  "compatibility_flags": ["global_fetch_strictly_public"],
  "workers_dev": false,
  "preview_urls": false,
  "limits": {
    "subrequests": 5
  },
  "vars": {
    "ALLOWED_ORIGINS": "https://<foood-origin>"
  },
  "ratelimits": [
    {
      "name": "IMPORT_RATE_LIMITER",
      "namespace_id": "<account-unique integer>",
      "simple": {
        "limit": 20,
        "period": 60
      }
    }
  ],
  "observability": {
    "logs": {
      "enabled": true,
      "head_sampling_rate": 0.05
    }
  }
}
```

The limits and origins above are illustrative, not deployment-ready values.
Cloudflare's current Rate Limiting API requires Wrangler 4.36.0 or later.

## Foood client migration

Change `examples/foood/src/urlImport.js` so `getJsons` and browser DOM parsing
disappear. `processRecipe` should:

1. call the new endpoint with the encoded source URL;
2. check `res.ok`;
3. parse the response as JSON; and
4. return the Recipe object.

The client-side `findOfType` is still used by the exported `findImage` helper, so
it cannot be deleted without checking its callers. Its traversal should either
be retained for image discovery or replaced by a shared null-safe version. The
`proxy` constant should be renamed to describe the extraction service, ideally
configured per environment rather than buried as a production URL.

As a small follow-up, `Editor` should display import failures such as "no recipe
metadata found", "site took too long", and "page was too large". That is not
required to replace the proxy, but the new explicit error contract makes the
current silent failure unnecessarily opaque.

Deployment order should avoid breaking imports:

1. deploy and verify the new Worker;
2. update Foood to use it;
3. verify production imports and observe logs/rate limits;
4. disable or delete the old `get-page` route; and
5. confirm the old hostname no longer returns arbitrary HTML.

## Verification plan

### Extraction tests

- direct Recipe object;
- Recipe inside a top-level array;
- Recipe inside `@graph`;
- parent with both `@type` and `@graph`;
- `@type` array containing `Recipe`;
- nested Recipe object;
- multiple scripts and multiple recipes preserve first-match order;
- malformed script followed by valid script;
- nulls, primitives, empty scripts, and no Recipe;
- mixed-case/parameterized script `type` handling;
- chunked text callbacks;
- per-script, page, traversal-node, and traversal-depth limits.

Fixtures should be small, invented HTML documents. Do not check in copied recipe
pages.

### HTTP tests

- allowed `GET` and `OPTIONS`;
- missing, relative, credentialed, non-HTTP, localhost, private-IP, own-host, and
  non-default-port targets;
- disallowed method/path/origin;
- redirects: relative, cross-host, loop, missing `Location`, disallowed target,
  and over limit;
- upstream non-2xx, non-HTML, timeout, missing and oversized `Content-Length`,
  chunked oversized body, and truncated body;
- success/error CORS and `Vary` headers;
- rate-limit rejection occurs before fetch;
- cached successes avoid a second fetch and get caller-specific CORS headers;
- errors never contain upstream bodies, full URLs, or exception details.

Use Cloudflare's Vitest Workers pool for runtime integration coverage, since it
catches differences from Node such as Worker APIs and compatibility behavior.
Keep URL classification and Recipe traversal as pure unit-testable functions.

### Real-site smoke tests

After deployment, manually test the three URLs documented in `urlImport.js` plus
several current recipe sites, recognizing that historical URLs may have moved,
blocked automated clients, or changed markup. Verify:

- import populates title, yield, image, times, ingredients, and instructions;
- a page without Recipe metadata shows the expected failure;
- a large/slow page fails within the configured budget;
- an origin redirect still imports;
- a disallowed browser origin cannot read the result;
- repeated calls exercise caching and rate limiting; and
- the old Worker no longer acts as a generic proxy.

Some publishers block Cloudflare data-center traffic or require JavaScript to
generate markup. This Worker intentionally fetches static server HTML and should
not add browser rendering or anti-bot circumvention; those would greatly expand
cost and abuse risk.

## Open questions

- What exact production and local-development Foood origins should receive CORS
  access?
    - foood.jaredforsyth.com
    - localhost:5137
- Should the endpoint remain public with rate limits, or can it validate Foood's
  existing login token? This is the most important remaining security decision.
- What hostname and Cloudflare account/zone should own the Worker? Is a custom
  domain available so `workers.dev` and preview URLs can be disabled?
- Is returning the Recipe object directly the desired contract, or should the
  response be `{ recipe, source/finalUrl }`? The direct object is recommended for
  the smallest client change; returning a final URL may leak redirect details
  and is not currently needed.
- If a page contains multiple recipes, is returning the first acceptable, or
  should Foood eventually let the user choose?
- Are 2 MiB per page, 512 KiB per JSON-LD block, three redirects, and roughly a
  10-second overall timeout sufficient for the real sites Foood users import?
- What request rate is normal for Foood, and is the Cloudflare plan compatible
  with the Rate Limiting binding? The illustrative 20 requests/minute value
  should not be deployed without usage context.
- Should successful extraction be cached, and for how long? A 5-15 minute TTL is
  recommended unless immediate metadata updates matter.
- Should missing Recipe JSON-LD be `404`, while malformed-only JSON-LD is `422`,
  or does the client prefer one generic not-found response?
- Does Foood need non-Recipe structured data for image fallback? The current
  import returns only a Recipe, while `findImage` can inspect `ImageObject`,
  `WebPage`, and `Article` in other call paths; those behaviors should not be
  accidentally conflated.
- Should visible import error UI be included in the implementation task, or kept
  as a follow-up?
- Are there known recipe sites that require more than static HTML, reject the
  Cloudflare Worker user agent/network, or rely on JSON-LD syntax that is not
  strict JSON?
