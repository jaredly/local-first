const dns = require('dns');
const { Agent, fetch } = require('undici');
const cheerio = require('cheerio');
const ipaddr = require('ipaddr.js');

const ENDPOINT = '/api/json-ld';
const MAX_URL_LENGTH = 2048;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10 * 1000;
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const USER_CONCURRENCY = 2;
const GLOBAL_CONCURRENCY = 8;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost']);
const DEFAULT_BLOCKED_HOSTNAMES = new Set(['logic.jaredforsyth.com']);

class ImportError extends Error {
    constructor(status, code, message = code) {
        super(message);
        this.name = 'ImportError';
        this.status = status;
        this.code = code;
    }
}

const cancelBody = async response => {
    if (response && response.body) {
        try {
            await response.body.cancel();
        } catch (_) {
            // The connection may already be closed.
        }
    }
};

const normalizeHostname = hostname =>
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

const isLocalHostname = hostname => {
    const lower = normalizeHostname(hostname).toLowerCase();
    return (
        LOCAL_HOSTNAMES.has(lower) ||
        lower.endsWith('.localhost') ||
        lower.endsWith('.local') ||
        lower.endsWith('.internal') ||
        lower.endsWith('.home.arpa')
    );
};

const isPublicAddress = address => {
    try {
        return ipaddr.process(address).range() === 'unicast';
    } catch (_) {
        return false;
    }
};

const parseTargetUrl = (raw, blockedHostnames = DEFAULT_BLOCKED_HOSTNAMES) => {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
        throw new ImportError(400, 'invalid_url');
    }

    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        throw new ImportError(400, 'invalid_url');
    }

    if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.username !== '' ||
        url.password !== '' ||
        url.hostname === '' ||
        url.port !== '' ||
        isLocalHostname(url.hostname) ||
        blockedHostnames.has(normalizeHostname(url.hostname).toLowerCase())
    ) {
        throw new ImportError(400, 'invalid_url');
    }

    const hostname = normalizeHostname(url.hostname);
    if (ipaddr.isValid(hostname) && !isPublicAddress(hostname)) {
        throw new ImportError(400, 'invalid_url');
    }

    return url;
};

const createSafeLookup = (resolver = dns.lookup) => (hostname, options, callback) => {
    resolver(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
        if (error) {
            callback(error);
            return;
        }

        const results = Array.isArray(addresses) ? addresses : [];
        if (
            results.length === 0 ||
            results.some(result => !result || !isPublicAddress(result.address))
        ) {
            const lookupError = new Error('Target did not resolve exclusively to public addresses');
            lookupError.code = 'ENOTFOUND';
            callback(lookupError);
            return;
        }

        const requestedFamily = options && Number(options.family);
        const selected =
            results.find(result => !requestedFamily || result.family === requestedFamily) ||
            results[0];
        callback(null, selected.address, selected.family);
    });
};

const createDispatcher = (resolver = dns.lookup) =>
    new Agent({
        connect: {
            lookup: createSafeLookup(resolver),
            timeout: REQUEST_TIMEOUT_MS,
        },
        connections: GLOBAL_CONCURRENCY,
        pipelining: 1,
    });

const readBoundedBody = async (response, maxBytes = MAX_PAGE_BYTES) => {
    const declaredLength = response.headers.get('content-length');
    if (declaredLength != null) {
        const length = Number(declaredLength);
        if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
            await cancelBody(response);
            throw new ImportError(413, 'recipe_page_too_large');
        }
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
            await cancelBody(response);
            throw new ImportError(413, 'recipe_page_too_large');
        }
        chunks.push(buffer);
    }
    return { html: Buffer.concat(chunks, total).toString('utf8'), bytesRead: total };
};

const extractJsonLd = (html, maxScriptBytes = MAX_SCRIPT_BYTES) => {
    const $ = cheerio.load(html);
    const jsonLd = [];
    let matchingScripts = 0;
    let invalidScripts = 0;

    $('script[type]').each((_, element) => {
        const rawType = $(element).attr('type');
        const mediaType =
            typeof rawType === 'string'
                ? rawType
                      .split(';', 1)[0]
                      .trim()
                      .toLowerCase()
                : '';
        if (mediaType !== 'application/ld+json') {
            return;
        }

        matchingScripts += 1;
        const text = $(element).text();
        if (Buffer.byteLength(text, 'utf8') > maxScriptBytes) {
            invalidScripts += 1;
            return;
        }

        try {
            jsonLd.push(JSON.parse(text));
        } catch (_) {
            invalidScripts += 1;
        }
    });

    return { jsonLd, matchingScripts, invalidScripts };
};

const fetchPage = async ({
    rawUrl,
    dispatcher,
    signal,
    fetchImpl = fetch,
    blockedHostnames = DEFAULT_BLOCKED_HOSTNAMES,
    maxRedirects = MAX_REDIRECTS,
    maxBytes = MAX_PAGE_BYTES,
}) => {
    let current = parseTargetUrl(rawUrl, blockedHostnames);
    const seen = new Set();
    let redirects = 0;

    while (true) {
        if (signal.aborted) {
            throw signal.reason;
        }
        const serialized = current.toString();
        if (seen.has(serialized)) {
            throw new ImportError(502, 'upstream_error');
        }
        seen.add(serialized);

        let response;
        try {
            response = await fetchImpl(current, {
                dispatcher,
                redirect: 'manual',
                signal,
                headers: {
                    accept: 'text/html, application/xhtml+xml',
                    'user-agent': 'Foood recipe importer/1',
                },
            });
        } catch (error) {
            if (signal.aborted || (error && error.name === 'AbortError')) {
                throw signal.reason || error;
            }
            throw new ImportError(502, 'upstream_error');
        }

        if (REDIRECT_STATUSES.has(response.status)) {
            if (redirects >= maxRedirects) {
                await cancelBody(response);
                throw new ImportError(502, 'upstream_error');
            }
            const location = response.headers.get('location');
            await cancelBody(response);
            if (!location) {
                throw new ImportError(502, 'upstream_error');
            }
            let redirected;
            try {
                redirected = new URL(location, current);
            } catch (_) {
                throw new ImportError(502, 'upstream_error');
            }
            current = parseTargetUrl(redirected.toString(), blockedHostnames);
            redirects += 1;
            continue;
        }

        if (!response.ok) {
            const upstreamStatus = response.status;
            await cancelBody(response);
            const error = new ImportError(502, 'upstream_error');
            error.upstreamStatus = upstreamStatus;
            throw error;
        }

        const contentType = (response.headers.get('content-type') || '')
            .split(';', 1)[0]
            .trim()
            .toLowerCase();
        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            await cancelBody(response);
            throw new ImportError(415, 'unsupported_content_type');
        }

        const body = await readBoundedBody(response, maxBytes);
        return {
            ...body,
            redirects,
            upstreamStatus: response.status,
        };
    }
};

class ImportLimiter {
    constructor({
        rateLimit = RATE_LIMIT,
        rateWindowMs = RATE_WINDOW_MS,
        userConcurrency = USER_CONCURRENCY,
        globalConcurrency = GLOBAL_CONCURRENCY,
    } = {}) {
        this.rateLimit = rateLimit;
        this.rateWindowMs = rateWindowMs;
        this.userConcurrency = userConcurrency;
        this.globalConcurrency = globalConcurrency;
        this.rates = new Map();
        this.activeByUser = new Map();
        this.active = 0;
    }

    acquire(userId, now = Date.now()) {
        for (const [key, entry] of this.rates) {
            if (now - entry.startedAt >= this.rateWindowMs) {
                this.rates.delete(key);
            }
        }

        let rate = this.rates.get(userId);
        if (!rate) {
            rate = { startedAt: now, count: 0 };
            this.rates.set(userId, rate);
        }
        if (rate.count >= this.rateLimit) {
            return {
                ok: false,
                retryAfter: Math.max(1, Math.ceil((rate.startedAt + this.rateWindowMs - now) / 1000)),
            };
        }
        rate.count += 1;

        const userActive = this.activeByUser.get(userId) || 0;
        if (userActive >= this.userConcurrency || this.active >= this.globalConcurrency) {
            return { ok: false, retryAfter: 1 };
        }

        this.active += 1;
        this.activeByUser.set(userId, userActive + 1);
        let released = false;
        return {
            ok: true,
            release: () => {
                if (released) {
                    return;
                }
                released = true;
                this.active -= 1;
                const remaining = (this.activeByUser.get(userId) || 1) - 1;
                if (remaining > 0) {
                    this.activeByUser.set(userId, remaining);
                } else {
                    this.activeByUser.delete(userId);
                }
            },
        };
    }
}

const isAllowedOrigin = origin => {
    if (origin == null) {
        return true;
    }
    if (origin === 'https://foood.jaredforsyth.com') {
        return true;
    }
    try {
        const url = new URL(origin);
        return (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            (url.hostname === 'localhost' ||
                url.hostname === '127.0.0.1' ||
                url.hostname === '[::1]' ||
                url.hostname === '::1')
        );
    } catch (_) {
        return false;
    }
};

const setCorsHeaders = (req, res) => {
    const origin = req.get('origin');
    res.vary('Origin');
    if (origin && isAllowedOrigin(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    } else {
        res.removeHeader('Access-Control-Allow-Origin');
    }
};

const originMiddleware = (req, res, next) => {
    const origin = req.get('origin');
    if (!isAllowedOrigin(origin)) {
        setCorsHeaders(req, res);
        return res.status(403).json({ error: 'origin_not_allowed' });
    }
    setCorsHeaders(req, res);
    next();
};

const errorResponse = (res, error, logger = console) => {
    if (error instanceof ImportError) {
        return res.status(error.status).json({ error: error.code });
    }
    if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        return res.status(504).json({ error: 'upstream_timeout' });
    }
    logger.error('Unexpected recipe import error', {
        name: error && typeof error.name === 'string' ? error.name : 'Error',
    });
    return res.status(502).json({ error: 'upstream_error' });
};

const createRecipeImportHandler = ({
    dispatcher = createDispatcher(),
    limiter = new ImportLimiter(),
    fetchImpl = fetch,
    now = Date.now,
    timeoutMs = REQUEST_TIMEOUT_MS,
    blockedHostnames = DEFAULT_BLOCKED_HOSTNAMES,
    logger = console,
} = {}) => async (req, res) => {
    const startedAt = now();
    let release = null;
    let clientDisconnected = false;
    const requestController = new AbortController();
    const timeout = setTimeout(() => requestController.abort(new DOMException('Timed out', 'TimeoutError')), timeoutMs);
    const abortForDisconnect = () => {
        clientDisconnected = true;
        requestController.abort(new DOMException('Client disconnected', 'AbortError'));
    };
    const onAborted = () => abortForDisconnect();
    const onResponseClose = () => {
        if (!res.writableEnded) {
            abortForDisconnect();
        }
    };
    req.once('aborted', onAborted);
    res.once('close', onResponseClose);

    const diagnostic = {
        userId: req.auth && req.auth.id,
        outcome: 'upstream_error',
        elapsedMs: 0,
        upstreamStatus: null,
        redirects: 0,
        bytesRead: 0,
        matchingScripts: 0,
        parsedPayloads: 0,
    };

    try {
        const target = parseTargetUrl(req.query.url, blockedHostnames);
        const acquired = limiter.acquire(req.auth.id, now());
        if (!acquired.ok) {
            res.set('Retry-After', String(acquired.retryAfter));
            diagnostic.outcome = 'rate_limited';
            return res.status(429).json({ error: 'rate_limited' });
        }
        release = acquired.release;

        const fetched = await fetchPage({
            rawUrl: target.toString(),
            dispatcher,
            signal: requestController.signal,
            fetchImpl,
            blockedHostnames,
        });
        diagnostic.upstreamStatus = fetched.upstreamStatus;
        diagnostic.redirects = fetched.redirects;
        diagnostic.bytesRead = fetched.bytesRead;

        if (requestController.signal.aborted) {
            throw requestController.signal.reason;
        }
        const extracted = extractJsonLd(fetched.html);
        diagnostic.matchingScripts = extracted.matchingScripts;
        diagnostic.parsedPayloads = extracted.jsonLd.length;

        if (extracted.matchingScripts === 0) {
            throw new ImportError(404, 'json_ld_not_found');
        }
        if (extracted.jsonLd.length === 0) {
            throw new ImportError(422, 'invalid_json_ld');
        }

        diagnostic.outcome = 'success';
        return res.status(200).json({ jsonLd: extracted.jsonLd });
    } catch (error) {
        if (clientDisconnected) {
            diagnostic.outcome = 'client_disconnected';
            return;
        }
        diagnostic.outcome =
            error instanceof ImportError
                ? error.code
                : error && (error.name === 'AbortError' || error.name === 'TimeoutError')
                ? 'upstream_timeout'
                : 'upstream_error';
        if (error && error.upstreamStatus) {
            diagnostic.upstreamStatus = error.upstreamStatus;
        }
        return errorResponse(res, error, logger);
    } finally {
        clearTimeout(timeout);
        req.removeListener('aborted', onAborted);
        res.removeListener('close', onResponseClose);
        if (release) {
            release();
        }
        diagnostic.elapsedMs = Math.max(0, now() - startedAt);
        logger.log('recipe_import', diagnostic);
    }
};

const setupRecipeImport = (app, authMiddleware, options = {}) => {
    const handler = createRecipeImportHandler(options);
    app.get(ENDPOINT, originMiddleware, authMiddleware, handler);
    app.all(ENDPOINT, originMiddleware, (req, res) => {
        res.set('Allow', 'GET, OPTIONS');
        res.status(405).json({ error: 'method_not_allowed' });
    });
    return handler;
};

module.exports = {
    ENDPOINT,
    GLOBAL_CONCURRENCY,
    ImportError,
    ImportLimiter,
    MAX_PAGE_BYTES,
    MAX_REDIRECTS,
    MAX_SCRIPT_BYTES,
    RATE_LIMIT,
    RATE_WINDOW_MS,
    USER_CONCURRENCY,
    createDispatcher,
    createRecipeImportHandler,
    createSafeLookup,
    extractJsonLd,
    fetchPage,
    isAllowedOrigin,
    isPublicAddress,
    parseTargetUrl,
    setupRecipeImport,
};
