const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
    ImportLimiter,
    MAX_PAGE_BYTES,
    createRecipeImportHandler,
    createSafeLookup,
    extractJsonLd,
    fetchPage,
    isAllowedOrigin,
    isPublicAddress,
    parseTargetUrl,
    setupRecipeImport,
} = require('./recipe-import');

const silentLogger = {
    log() {},
    error() {},
};

class FakeResponse extends EventEmitter {
    constructor() {
        super();
        this.headers = new Map();
        this.statusCode = 200;
        this.body = null;
        this.writableEnded = false;
    }

    set(name, value) {
        this.headers.set(name.toLowerCase(), String(value));
        return this;
    }

    removeHeader(name) {
        this.headers.delete(name.toLowerCase());
    }

    vary(value) {
        this.set('vary', value);
        return this;
    }

    status(status) {
        this.statusCode = status;
        return this;
    }

    json(body) {
        this.body = body;
        this.writableEnded = true;
        return this;
    }
}

const fakeRequest = ({ url = 'https://example.com/recipe', origin, userId = 1 } = {}) => {
    const req = new EventEmitter();
    req.query = { url };
    req.auth = { id: userId };
    req.get = name => (name.toLowerCase() === 'origin' ? origin : undefined);
    return req;
};

const callLookup = (lookup, hostname = 'example.com', options = {}) =>
    new Promise((resolve, reject) => {
        lookup(hostname, options, (error, address, family) => {
            if (error) {
                reject(error);
            } else {
                resolve({ address, family });
            }
        });
    });

test('accepts public HTTP URLs and rejects unsafe URL forms', () => {
    assert.equal(parseTargetUrl('https://example.com/recipe').hostname, 'example.com');
    assert.equal(parseTargetUrl('http://example.com:80/recipe').port, '');

    [
        '',
        '/relative',
        'file:///tmp/recipe',
        'https://user:password@example.com/',
        'https://example.com:8443/',
        'http://localhost/',
        'http://127.0.0.1/',
        'http://[::1]/',
        'https://logic.jaredforsyth.com/',
    ].forEach(url => {
        assert.throws(() => parseTargetUrl(url), error => error.code === 'invalid_url');
    });
});

test('classifies only ordinary public unicast addresses as public', () => {
    assert.equal(isPublicAddress('8.8.8.8'), true);
    assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
    assert.equal(isPublicAddress('127.0.0.1'), false);
    assert.equal(isPublicAddress('10.0.0.1'), false);
    assert.equal(isPublicAddress('169.254.1.1'), false);
    assert.equal(isPublicAddress('::1'), false);
    assert.equal(isPublicAddress('fc00::1'), false);
    assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
    assert.equal(isPublicAddress('not-an-ip'), false);
});

test('safe DNS lookup pins a public address and rejects private or mixed answers', async () => {
    const publicLookup = createSafeLookup((hostname, options, callback) =>
        callback(null, [
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ]),
    );
    assert.deepEqual(await callLookup(publicLookup, 'example.com', { family: 4 }), {
        address: '93.184.216.34',
        family: 4,
    });

    for (const addresses of [
        [{ address: '127.0.0.1', family: 4 }],
        [
            { address: '93.184.216.34', family: 4 },
            { address: '10.0.0.2', family: 4 },
        ],
    ]) {
        const lookup = createSafeLookup((hostname, options, callback) =>
            callback(null, addresses),
        );
        await assert.rejects(callLookup(lookup), /public addresses/);
    }
});

test('extracts valid JSON-LD in document order and skips malformed blocks', () => {
    const result = extractJsonLd(`
        <script type="Application/LD+JSON; charset=utf-8">{"name":"first"}</script>
        <script type="application/ld+json">{bad json</script>
        <script type="application/ld+json">[{"name":"second"}]</script>
        <script type="text/javascript">{"ignored":true}</script>
    `);

    assert.deepEqual(result.jsonLd, [{ name: 'first' }, [{ name: 'second' }]]);
    assert.equal(result.matchingScripts, 3);
    assert.equal(result.invalidScripts, 1);
});

test('treats an oversized JSON-LD script as invalid without hiding a valid block', () => {
    const result = extractJsonLd(
        `<script type="application/ld+json">"${'x'.repeat(32)}"</script>
         <script type="application/ld+json">{"ok":true}</script>`,
        16,
    );
    assert.deepEqual(result.jsonLd, [{ ok: true }]);
    assert.equal(result.invalidScripts, 1);
});

test('follows relative redirects manually and returns bounded HTML', async () => {
    const calls = [];
    const responses = [
        new Response('', { status: 302, headers: { location: '/recipe' } }),
        new Response('<html>recipe</html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    ];
    const result = await fetchPage({
        rawUrl: 'https://example.com/start',
        dispatcher: {},
        signal: new AbortController().signal,
        fetchImpl: async (url, options) => {
            calls.push({ url: url.toString(), options });
            return responses.shift();
        },
    });

    assert.equal(result.html, '<html>recipe</html>');
    assert.equal(result.redirects, 1);
    assert.deepEqual(
        calls.map(call => call.url),
        ['https://example.com/start', 'https://example.com/recipe'],
    );
    assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ['accept', 'user-agent']);
});

test('rejects redirect loops, unsupported content, and oversized pages', async () => {
    await assert.rejects(
        fetchPage({
            rawUrl: 'https://example.com/start',
            dispatcher: {},
            signal: new AbortController().signal,
            fetchImpl: async () =>
                new Response('', { status: 302, headers: { location: '/start' } }),
        }),
        error => error.code === 'upstream_error',
    );

    await assert.rejects(
        fetchPage({
            rawUrl: 'https://example.com/file',
            dispatcher: {},
            signal: new AbortController().signal,
            fetchImpl: async () =>
                new Response('{}', {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
        }),
        error => error.code === 'unsupported_content_type',
    );

    await assert.rejects(
        fetchPage({
            rawUrl: 'https://example.com/large',
            dispatcher: {},
            signal: new AbortController().signal,
            fetchImpl: async () =>
                new Response('', {
                    status: 200,
                    headers: {
                        'content-type': 'text/html',
                        'content-length': String(MAX_PAGE_BYTES + 1),
                    },
                }),
        }),
        error => error.code === 'recipe_page_too_large',
    );

    await assert.rejects(
        fetchPage({
            rawUrl: 'https://example.com/chunked',
            dispatcher: {},
            signal: new AbortController().signal,
            maxBytes: 4,
            fetchImpl: async () =>
                new Response('12345', {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                }),
        }),
        error => error.code === 'recipe_page_too_large',
    );
});

test('rate limiter enforces windows and releases concurrency exactly once', () => {
    const limiter = new ImportLimiter({
        rateLimit: 3,
        rateWindowMs: 1000,
        userConcurrency: 2,
        globalConcurrency: 2,
    });
    const first = limiter.acquire('a', 0);
    const second = limiter.acquire('a', 0);
    const third = limiter.acquire('a', 0);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);

    first.release();
    first.release();
    assert.equal(limiter.active, 1);
    second.release();
    assert.equal(limiter.active, 0);
    assert.equal(limiter.acquire('a', 0).ok, false);

    const afterWindow = limiter.acquire('a', 1000);
    assert.equal(afterWindow.ok, true);
    afterWindow.release();
});

test('handler returns JSON-LD and maps missing or invalid blocks', async () => {
    const makeHandler = html =>
        createRecipeImportHandler({
            dispatcher: {},
            limiter: new ImportLimiter(),
            fetchImpl: async () =>
                new Response(html, {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                }),
            logger: silentLogger,
        });

    const success = new FakeResponse();
    await makeHandler(
        '<script type="application/ld+json">{"@type":"Recipe","name":"Dinner"}</script>',
    )(fakeRequest(), success);
    assert.equal(success.statusCode, 200);
    assert.equal(success.body.jsonLd[0].name, 'Dinner');

    const missing = new FakeResponse();
    await makeHandler('<html></html>')(fakeRequest(), missing);
    assert.deepEqual({ status: missing.statusCode, body: missing.body }, {
        status: 404,
        body: { error: 'json_ld_not_found' },
    });

    const invalid = new FakeResponse();
    await makeHandler('<script type="application/ld+json">{bad</script>')(
        fakeRequest(),
        invalid,
    );
    assert.deepEqual({ status: invalid.statusCode, body: invalid.body }, {
        status: 422,
        body: { error: 'invalid_json_ld' },
    });
});

test('handler rejects invalid URLs before fetch and converts deadline expiry to 504', async () => {
    let fetchCalls = 0;
    const handler = createRecipeImportHandler({
        dispatcher: {},
        fetchImpl: async (url, options) => {
            fetchCalls += 1;
            return new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(options.signal.reason));
            });
        },
        timeoutMs: 5,
        logger: silentLogger,
    });

    const invalid = new FakeResponse();
    await handler(fakeRequest({ url: 'http://127.0.0.1/' }), invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(fetchCalls, 0);

    const timeout = new FakeResponse();
    await handler(fakeRequest(), timeout);
    assert.equal(timeout.statusCode, 504);
    assert.deepEqual(timeout.body, { error: 'upstream_timeout' });
    assert.equal(fetchCalls, 1);
});

test('handler aborts and releases capacity when the client disconnects', async () => {
    const limiter = new ImportLimiter({ userConcurrency: 1, globalConcurrency: 1 });
    let fetchStarted;
    const started = new Promise(resolve => {
        fetchStarted = resolve;
    });
    const handler = createRecipeImportHandler({
        dispatcher: {},
        limiter,
        fetchImpl: async (url, options) => {
            fetchStarted();
            return new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(options.signal.reason));
            });
        },
        logger: silentLogger,
    });

    const response = new FakeResponse();
    const request = handler(fakeRequest(), response);
    await started;
    response.emit('close');
    await request;

    assert.equal(response.body, null);
    assert.equal(limiter.active, 0);
    assert.equal(limiter.activeByUser.size, 0);
});

test('route setup keeps auth before the handler and enforces actual-response CORS', () => {
    const registered = {};
    const app = {
        get(path, ...handlers) {
            registered.get = { path, handlers };
        },
        all(path, ...handlers) {
            registered.all = { path, handlers };
        },
    };
    const authMiddleware = () => {};
    setupRecipeImport(app, authMiddleware, {
        dispatcher: {},
        logger: silentLogger,
    });

    assert.equal(registered.get.path, '/api/json-ld');
    assert.equal(registered.get.handlers[1], authMiddleware);
    assert.equal(registered.all.path, '/api/json-ld');

    const originGuard = registered.get.handlers[0];
    const disallowed = new FakeResponse();
    disallowed.set('Access-Control-Allow-Origin', 'https://evil.example');
    originGuard(
        fakeRequest({ origin: 'https://evil.example' }),
        disallowed,
        () => assert.fail('disallowed origin continued'),
    );
    assert.equal(disallowed.statusCode, 403);
    assert.equal(disallowed.headers.has('access-control-allow-origin'), false);

    const allowed = new FakeResponse();
    let continued = false;
    originGuard(
        fakeRequest({ origin: 'https://foood.jaredforsyth.com' }),
        allowed,
        () => {
            continued = true;
        },
    );
    assert.equal(continued, true);
    assert.equal(
        allowed.headers.get('access-control-allow-origin'),
        'https://foood.jaredforsyth.com',
    );
});

test('origin policy allows production, local any-port, and authenticated non-browser calls', () => {
    assert.equal(isAllowedOrigin('https://foood.jaredforsyth.com'), true);
    assert.equal(isAllowedOrigin('http://localhost:1236'), true);
    assert.equal(isAllowedOrigin('https://127.0.0.1:9999'), true);
    assert.equal(isAllowedOrigin('http://[::1]:8080'), true);
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
});
