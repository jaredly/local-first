# Implementation log

## Phase 1: Runtime and dependencies

- Started on 2026-07-27.
- Confirmed the active development runtime is Node 24.13.1.
- Updated `general-server` from the obsolete Node 13 declaration to Node 24.
- Selected direct Node-24-compatible dependencies:
  - `better-sqlite3` 13 for the shared auth/server persistence layer;
  - Cheerio 1.2 for HTML parsing;
  - Undici 8 for controlled outbound HTTP; and
  - `ipaddr.js` 2.4 for IPv4/IPv6 classification.
- Implementation choice: use Undici's custom DNS lookup plus `ipaddr.js` instead
  of adding a second SSRF-agent package. The lookup will validate and pin the
  address used by the connection, with regression tests for private and mixed
  DNS answers.

### Issues and workarounds

- `better-sqlite3` is a native dependency and the existing 6.x release predates
  Node 24. Both package declarations must move together because the repository
  packer rejects mismatched dependency versions. Runtime/database verification
  is required before endpoint work proceeds.
- Initial sandboxed Yarn installs failed with `ENOTFOUND registry.yarnpkg.com`.
  Re-running with approved network access completed successfully.
- Yarn 1 emitted a Node deprecation warning because Yarn itself uses legacy
  `url.parse`. Babel also reported the repository's existing stale Browserslist
  data. Neither warning comes from the new runtime code.

### Verification

- Installed and locked the new dependencies.
- Confirmed `better-sqlite3` 13 performs in-memory DDL, writes, and reads under
  Node 24.13.1.
- Confirmed the real auth modules create all three tables, create a user and
  signed session, and validate that session under Node 24.
- Confirmed Cheerio, Undici, and `ipaddr.js` resolve from `general-server`.

Phase 1 complete.

## Phase 2: Authenticated JSON-LD endpoint

- Extended `runMulti2` to return the same auth middleware already used by
  `/dbs/*`.
- Registered `GET /api/json-ld` in `general-server` with origin checking followed
  by the existing session middleware.
- Added a JSON-LD import module with:
  - URL/protocol/credential/port/self-host validation;
  - IPv4 and IPv6 public-address classification;
  - an Undici dispatcher whose socket lookup rejects any private/mixed DNS
    answer and pins the validated address;
  - manual redirect validation with loop and three-hop limits;
  - a 10-second deadline and 2 MiB streamed decoded-body cap;
  - HTML/XHTML content-type enforcement;
  - Cheerio extraction of valid `application/ld+json` scripts only;
  - stable JSON error responses;
  - 100 attempts per user per 10 minutes;
  - two concurrent imports per user and eight globally; and
  - bounded structured diagnostics without URLs, tokens, or payload contents.

### Issues and workarounds

- The shared Express setup installs permissive CORS before app-specific routes
  and consumes preflight requests. The import route therefore enforces its
  allowlist on the actual authenticated GET and explicitly removes/overwrites
  the global CORS response header. A global CORS refactor was intentionally
  avoided because it could affect unrelated clients.
- Node's `URL.hostname` retains brackets around IPv6 literals. Hostname
  normalization was added so `[::1]` is rejected before DNS/fetch.

### Verification

- Confirmed the module and modified server bundle compile under the repository's
  Babel/Flow bootstrap.
- Smoke-tested public/private IP classification, local/self URL rejection,
  safe DNS lookup behavior, relative redirects, MIME normalization, bounded page
  fetching, and JSON-LD parsing with injected responses.

Phase 2 implementation complete; exhaustive endpoint coverage is tracked in
Phase 4.

## Phase 3: Foood migration and recipe selection

- Replaced the public Worker URL and browser HTML parsing with authenticated
  `/api/json-ld` requests.
- Added bounded, null-safe traversal across arrays, nested objects, `@graph`, and
  string/array `@type` values.
- Added Recipe deduplication by object identity and non-empty `@id`.
- Injected the authenticated importer from `App` through both new/edit recipe
  routes instead of passing the raw token into the editor.
- Split candidate fetching from candidate application.
- Added loading state, visible mapped errors, stale request cancellation, and a
  Material UI chooser for pages containing multiple recipes.
- Preserved editor contents until a single candidate is selected.
- Removed payload/debug logging and all references to the old `get-page` URL.

### Issues and workarounds

- Flow could not infer named exports attached to CommonJS `module.exports`.
  `urlImport.js` now uses explicit ES named/default exports, which satisfies Flow
  and Parcel.
- The repository-wide focused Flow run still reports unrelated missing admin
  import fixtures and existing dependency/type errors. Filtering the result
  confirmed no errors remain in the four touched Foood files.
- Parcel reports the pre-existing missing `.workbox-config.js` plugin warning,
  but completes the production build successfully.

### Verification

- Ran the Foood production build successfully after the migration.
- Re-ran focused Flow and confirmed no touched-file errors.

Phase 3 implementation complete; traversal/transport and UI behavior coverage
continues in Phase 4 and Phase 5.

## Phase 4: Automated coverage

- Added a Node 24 `node:test` suite for the general-server module.
- Added Foood Jest coverage for authenticated transport, JSON-LD traversal,
  Recipe discovery/deduplication, traversal limits, abort behavior, server error
  mapping, and user-visible messages.
- Refactored candidate application to compute/validate imported values before
  mutating editor state, preventing partial updates when recipe conversion fails.

### Issues and workarounds

- The legacy Foood Jest transform emits generator-based code for async functions
  but does not preload `regeneratorRuntime`. The new async test imports the same
  `regenerator-runtime/runtime` entry already used by Foood's browser bootstrap.

### Verification

- General-server: 13 tests passed, including client-disconnect cancellation and
  limiter release.
- Foood: 40 tests passed across the existing search suite and the new import
  suite.
- `git diff --check` passed.
- Confirmed no `get-page.jaredly.workers.dev` references remain in Foood or
  general-server.

Phase 4 complete.

## Phase 5: Packaging and integration verification

- Updated the monorepo packer's Babel and Recast dependencies so it can run
  against the repository's current dependency graph under Node 24.
- Generated the ignored `public/general-server` deployment artifact and
  installed its production dependency tree.
- Confirmed the packed artifact contains the new route, Node 24 engine
  declaration, and all direct/runtime dependencies.
- Started the packed server with a real auth database and exercised the endpoint
  over HTTP:
  - the root health route returned 200;
  - an unauthenticated import returned 401 before any outbound fetch;
  - the generated session authenticated successfully at `/api/user`;
  - an authenticated request from the local Foood origin received the exact
    allowed CORS header and rejected a loopback target with `invalid_url`; and
  - a disallowed origin received 403 with no access-control allow-origin header.

### Issues and workarounds

- The packer initially failed because its local dependencies had not been
  installed. After installation, its 2020-era Babel preset failed against the
  modern `@babel/compat-data` package exports. Updating the packer's Babel
  packages and Recast restored packaging under Node 24.
- Installing the packed artifact reports deprecations in the existing
  Firebase/Google Cloud and `broadcast-channel` dependency trees. These are
  transitive legacy dependencies and did not prevent installation or startup.
- The in-app browser client failed during bootstrap with
  `Cannot redefine property: process`. A temporary copy that avoided the global
  mutation was correctly rejected by the browser bridge as untrusted. No
  installed tooling was modified; visual browser verification of the editor
  remains blocked by the browser harness. The importer transport, traversal, and
  error behavior are covered by Jest, while the packed server behavior was
  verified directly over HTTP.
- Both local development servers were stopped after the integration checks.
- A final hardening review added response-socket disconnect cancellation and
  reduced unexpected-error logging to a sanitized error name. The packed
  artifact was regenerated afterward.

### Final verification

- General-server: 13 tests passed.
- Foood: 40 tests passed.
- Foood production Parcel build passed with the pre-existing Workbox warning
  noted above.
- `node pack.js general-server` completed against the final server source.
- `git diff --check` passed.

Phase 5 complete.
