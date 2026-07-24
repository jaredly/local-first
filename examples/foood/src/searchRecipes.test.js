// @flow
import { deltaToSearchText, normalizeSearchText, searchRecipes } from './searchRecipes';
import { updateSearchQuery } from './searchQuery';

const actorId = 'current-user';

const recipe = (
    id,
    title,
    { body = '', status, otherStatus, updatedDate = 1, trashedDate, embeds = [] } = {},
) => ({
    id,
    about: {
        title,
        author: '',
        source: '',
        image: '',
    },
    contents: {
        meta: {},
        text: {
            ops: [{ insert: body }, ...embeds.map((insert) => ({ insert }))],
        },
        version: '',
        changeLog: [],
    },
    statuses: {
        ...(status == null ? {} : { [actorId]: status }),
        ...(otherStatus == null ? {} : { 'other-user': otherStatus }),
    },
    createdDate: 1,
    updatedDate,
    ...(trashedDate == null ? {} : { trashedDate }),
    comments: {},
    tags: {},
});

const search = (items, query, searchActorId = actorId) =>
    searchRecipes(
        items.reduce((byId, item) => ({ ...byId, [item.id]: item }), {}),
        query,
        searchActorId,
    );

describe('title search', () => {
    test.each([
        ['Chicken Pot Pie', 'chickenpot'],
        ['ChickenPot Pie', 'chicken pot'],
        ['Mac-and-Cheese', 'mac and cheese'],
        ['Crème Brûlée', 'creme brulee'],
        ['creme brulee', 'CRÈME BRÛLÉE'],
    ])('normalizes %s for query %s', (title, query) => {
        expect(search([recipe('match', title)], query).titleMatches).toEqual(['match']);
    });

    test.each(['chiken pot pie', 'chikcen pot pie'])('uses Fuse for a normal typo: %s', (query) => {
        expect(search([recipe('match', 'Chicken Pot Pie')], query).titleMatches).toEqual(['match']);
    });

    test('does not admit an unrelated title', () => {
        const results = search(
            [recipe('match', 'Chicken Pot Pie'), recipe('other', 'Chocolate Chip Cookies')],
            'chiken pot pie',
        );
        expect(results.titleMatches).toEqual(['match']);
    });

    test('orders match quality within one status bin', () => {
        const results = search(
            [
                recipe('fuzzy', 'Chiken Soup', { status: 'favorite', updatedDate: 30 }),
                recipe('compact', 'ChickenSoup', { status: 'favorite', updatedDate: 20 }),
                recipe('exact', 'Chicken Soup', { status: 'favorite', updatedDate: 10 }),
            ],
            'chicken soup',
        );
        expect(results.titleMatches).toEqual(['exact', 'compact', 'fuzzy']);
    });

    test('orders closer fuzzy matches ahead of weaker fuzzy matches', () => {
        const results = search(
            [
                recipe('weaker', 'Chicken Potato Bake', { status: 'favorite' }),
                recipe('close', 'Chicken Pot Pie', { status: 'favorite' }),
            ],
            'chiken pot pie',
        );
        expect(results.titleMatches).toEqual(['close', 'weaker']);
    });

    test('orders status bins before match quality', () => {
        const results = search(
            [
                recipe('unset', 'Chicken Soup', { updatedDate: 40 }),
                recipe('to-try', 'Chicken Soup', { status: 'to try', updatedDate: 30 }),
                recipe('approved', 'Chicken Soup', { status: 'approved', updatedDate: 20 }),
                recipe('favorite', 'Chiken Soup', { status: 'favorite', updatedDate: 10 }),
            ],
            'chicken soup',
        );
        expect(results.titleMatches).toEqual(['favorite', 'approved', 'to-try', 'unset']);
    });

    test('uses updated date and ID as stable tie-breakers', () => {
        const results = search(
            [
                recipe('b', 'Chicken Soup', { status: 'favorite', updatedDate: 10 }),
                recipe('c', 'Chicken Soup', { status: 'favorite', updatedDate: 20 }),
                recipe('a', 'Chicken Soup', { status: 'favorite', updatedDate: 10 }),
            ],
            'chicken',
        );
        expect(results.titleMatches).toEqual(['c', 'a', 'b']);
    });

    test('does not use fuzzy matching for queries shorter than three characters', () => {
        const results = search([recipe('exact', 'Zebra'), recipe('fuzzy-only', 'Zip')], 'ze');
        expect(results.titleMatches).toEqual(['exact']);
    });

    test('supports multiple query words', () => {
        expect(
            search([recipe('match', 'Weeknight Chicken Pot Pie')], 'chiken pot pie').titleMatches,
        ).toEqual(['match']);
    });
});

describe('body search', () => {
    test('matches normalized and compact substrings without fuzzy matching', () => {
        expect(
            search([recipe('match', 'Dinner', { body: 'Add crème fraîche.' })], 'creme fraiche')
                .bodyMatches,
        ).toEqual(['match']);
        expect(
            search([recipe('match', 'Dinner', { body: 'Add soy sauce.' })], 'soysauce').bodyMatches,
        ).toEqual(['match']);
        expect(
            search([recipe('other', 'Dinner', { body: 'Add tomatoes.' })], 'tomatos').bodyMatches,
        ).toEqual([]);
    });

    test('keeps title matches out of the body group', () => {
        const results = search(
            [recipe('both', 'Chicken Soup', { body: 'Serve the chicken soup.' })],
            'chicken soup',
        );
        expect(results).toEqual({ titleMatches: ['both'], bodyMatches: [] });
    });

    test('orders body results by status, match tier, recency, and ID', () => {
        const results = search(
            [
                recipe('compact', 'Dinner', {
                    body: 'soysauce',
                    status: 'favorite',
                    updatedDate: 30,
                }),
                recipe('older', 'Dinner', {
                    body: 'soy sauce',
                    status: 'favorite',
                    updatedDate: 10,
                }),
                recipe('newer', 'Dinner', {
                    body: 'soy sauce',
                    status: 'favorite',
                    updatedDate: 20,
                }),
                recipe('approved', 'Dinner', {
                    body: 'soy sauce',
                    status: 'approved',
                    updatedDate: 40,
                }),
            ],
            'soy sauce',
        );
        expect(results.bodyMatches).toEqual(['newer', 'older', 'compact', 'approved']);
    });
});

describe('eligibility and text handling', () => {
    test('excludes trashed and current-user rejected recipes', () => {
        const results = search(
            [
                recipe('visible', 'Chicken'),
                recipe('trashed', 'Chicken', { trashedDate: 10 }),
                recipe('rejected', 'Chicken', { status: 'rejected' }),
                recipe('other-rejected', 'Chicken', { otherStatus: 'rejected' }),
            ],
            'chicken',
        );
        expect(results.titleMatches).toEqual(['other-rejected', 'visible']);
    });

    test('keeps anonymous results eligible and orders them by recency', () => {
        const results = search(
            [
                recipe('older', 'Chicken', { status: 'rejected', updatedDate: 10 }),
                recipe('newer', 'Chicken', { status: 'favorite', updatedDate: 20 }),
            ],
            'chicken',
            null,
        );
        expect(results.titleMatches).toEqual(['newer', 'older']);
    });

    test.each(['', '   ', '---'])('returns null for an empty query: %j', (query) => {
        expect(search([recipe('item', 'Chicken')], query)).toBeNull();
    });

    test('ignores Quill embeds while retaining string inserts', () => {
        const delta = {
            ops: [{ insert: 'before ' }, { insert: { image: 'image.jpg' } }, { insert: 'after' }],
        };
        expect(deltaToSearchText(delta)).toBe('before after');
        expect(
            search(
                [
                    recipe('match', 'Dinner', {
                        body: 'before ',
                        embeds: [{ image: 'image.jpg' }, 'after'],
                    }),
                ],
                'before after',
            ).bodyMatches,
        ).toEqual(['match']);
    });

    test('normalization retains non-Latin letters', () => {
        expect(normalizeSearchText('東京—ごはん')).toBe('東京 ごはん');
    });
});

describe('search query URLs', () => {
    test('round-trips reserved characters, spaces, Unicode, and diacritics', () => {
        const value = 'crème + salt & pepper=#1';
        const searchValue = updateSearchQuery('?view=cards', value);
        const query = new URLSearchParams(searchValue);
        expect(query.get('q')).toBe(value);
        expect(query.get('view')).toBe('cards');
    });

    test('clearing search removes only q', () => {
        expect(updateSearchQuery('?q=chicken&view=cards', '')).toBe('?view=cards');
        expect(updateSearchQuery('?q=chicken', '')).toBe('');
    });
});
