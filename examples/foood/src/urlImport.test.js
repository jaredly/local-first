// @flow

import 'regenerator-runtime/runtime';
import importRecipes, {
    UrlImportError,
    findAllOfType,
    importErrorMessage,
} from './urlImport';

const recipe = (name, extra = {}) => ({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name,
    ...extra,
});

describe('Recipe JSON-LD traversal', () => {
    test('finds direct, array, graph, type-array, and nested recipes in order', () => {
        const roots = [
            recipe('direct'),
            [recipe('array')],
            {
                '@graph': [
                    { '@type': 'Thing', child: recipe('nested') },
                    { '@type': ['Thing', 'Recipe'], name: 'type-array' },
                ],
            },
            null,
            'primitive',
        ];

        expect(findAllOfType(roots, 'Recipe').map(item => item.name)).toEqual([
            'direct',
            'array',
            'nested',
            'type-array',
        ]);
    });

    test('deduplicates object identity and non-empty @id without using recipe names', () => {
        const shared = recipe('shared');
        const sameId = recipe('other copy', { '@id': 'recipe:one' });
        const roots = [
            shared,
            shared,
            recipe('first ID', { '@id': 'recipe:one' }),
            sameId,
            recipe('same name'),
            recipe('same name'),
        ];

        expect(findAllOfType(roots, 'Recipe').map(item => item.name)).toEqual([
            'shared',
            'first ID',
            'same name',
            'same name',
        ]);
    });

    test('handles cycles defensively', () => {
        const cyclic = recipe('cycle');
        cyclic.self = cyclic;
        expect(findAllOfType([cyclic], 'Recipe')).toEqual([cyclic]);
    });

    test('enforces traversal depth and value limits', () => {
        expect(() => findAllOfType([{ a: { b: recipe('deep') } }], 'Recipe', 1)).toThrow(
            'invalid_response',
        );
        expect(() => findAllOfType([{ a: 1, b: 2 }], 'Recipe', 64, 2)).toThrow(
            'invalid_response',
        );
    });
});

describe('authenticated JSON-LD transport', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('sends the Foood token and returns every Recipe candidate', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                jsonLd: [
                    { '@graph': [recipe('one')] },
                    [recipe('two')],
                    { '@type': 'Article', name: 'not a recipe' },
                ],
            }),
        });

        await expect(
            importRecipes(
                'https://example.com/recipe?a=1&b=2',
                'https://logic.jaredforsyth.com',
                'session-token',
            ),
        ).resolves.toEqual([recipe('one'), recipe('two')]);

        expect(global.fetch).toHaveBeenCalledWith(
            'https://logic.jaredforsyth.com/api/json-ld?url=' +
                encodeURIComponent('https://example.com/recipe?a=1&b=2'),
            {
                headers: {
                    Authorization: 'Bearer: session-token',
                },
                signal: undefined,
            },
        );
    });

    test.each([
        [401, null, 'authentication_required'],
        [403, { error: 'origin_not_allowed' }, 'origin_not_allowed'],
        [404, { error: 'json_ld_not_found' }, 'json_ld_not_found'],
        [413, { error: 'recipe_page_too_large' }, 'recipe_page_too_large'],
        [429, { error: 'rate_limited' }, 'rate_limited'],
        [504, { error: 'upstream_timeout' }, 'upstream_timeout'],
    ])('maps HTTP %s error responses', async (status, body, expectedCode) => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => {
                if (body == null) {
                    throw new Error('not json');
                }
                return body;
            },
        });

        await expect(
            importRecipes('https://example.com', 'https://logic.jaredforsyth.com', 'token'),
        ).rejects.toMatchObject({ code: expectedCode });
    });

    test('rejects malformed success responses', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ jsonLd: 'not an array' }),
        });
        await expect(
            importRecipes('https://example.com', 'https://logic.jaredforsyth.com', 'token'),
        ).rejects.toMatchObject({ code: 'invalid_response' });
    });

    test('preserves AbortError and normalizes other network failures', async () => {
        const aborted = new Error('aborted');
        aborted.name = 'AbortError';
        global.fetch = jest.fn().mockRejectedValueOnce(aborted);
        await expect(
            importRecipes('https://example.com', 'https://logic.jaredforsyth.com', 'token'),
        ).rejects.toBe(aborted);

        global.fetch = jest.fn().mockRejectedValueOnce(new Error('network'));
        await expect(
            importRecipes('https://example.com', 'https://logic.jaredforsyth.com', 'token'),
        ).rejects.toMatchObject({ code: 'upstream_error' });
    });
});

describe('visible error messages', () => {
    test('maps known errors and has a safe fallback', () => {
        expect(importErrorMessage(new UrlImportError('rate_limited'))).toMatch(
            /Too many recipe imports/,
        );
        expect(importErrorMessage(new UrlImportError('no_recipes'))).toMatch(/No recipes/);
        expect(importErrorMessage(new Error('secret internal details'))).toBe(
            'The recipe could not be imported.',
        );
    });
});
