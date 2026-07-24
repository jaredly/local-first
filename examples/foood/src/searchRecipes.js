// @flow
import Fuse from 'fuse.js';
import type { RecipeT, RecipeStatus } from '../collections';
import { statusOrder } from './recipeSorting';

export const TITLE_FUZZY_THRESHOLD = 0.4;
const MIN_FUZZY_QUERY_LENGTH = 3;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const SEPARATORS = /[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u2010-\u2027]+/g;

type SearchDocument = {
    id: string,
    normalizedTitle: string,
    compactTitle: string,
    normalizedContents: string,
    compactContents: string,
};

type PreparedRecipeSearch = {
    actorId: ?string,
    recipes: { [id: string]: RecipeT },
    documents: Array<SearchDocument>,
    titleIndex: Fuse<SearchDocument>,
};

type Match = {
    id: string,
    tier: number,
    score: number,
};

export type RecipeSearchResults = {
    titleMatches: Array<string>,
    bodyMatches: Array<string>,
};

export const normalizeSearchText = (value: string): string => {
    const decomposed = typeof value.normalize === 'function' ? value.normalize('NFD') : value;
    const withoutDiacritics = decomposed.toLowerCase().replace(COMBINING_MARKS, '');
    const recomposed =
        typeof withoutDiacritics.normalize === 'function'
            ? withoutDiacritics.normalize('NFC')
            : withoutDiacritics;
    return recomposed.replace(SEPARATORS, ' ').trim();
};

export const compactSearchText = (value: string): string =>
    normalizeSearchText(value).replace(/ /g, '');

export const deltaToSearchText = (delta: { ops: Array<{ insert: mixed }> }): string =>
    delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

const statusRank = (recipe: RecipeT, actorId: ?string): number => {
    if (actorId == null) {
        return 0;
    }
    const status: ?RecipeStatus = recipe.statuses[actorId];
    const rank = statusOrder.indexOf(status);
    return rank === -1 ? statusOrder.indexOf(undefined) : rank;
};

const compareBase = (
    recipes: { [id: string]: RecipeT },
    actorId: ?string,
    a: string,
    b: string,
): number =>
    statusRank(recipes[a], actorId) - statusRank(recipes[b], actorId) ||
    recipes[b].updatedDate - recipes[a].updatedDate ||
    a.localeCompare(b);

export const prepareRecipeSearch = (
    recipes: { [id: string]: RecipeT },
    actorId: ?string,
): PreparedRecipeSearch => {
    const documents = Object.keys(recipes)
        .filter(
            (id) =>
                recipes[id].trashedDate == null &&
                (actorId == null || recipes[id].statuses[actorId] !== 'rejected'),
        )
        .map((id) => {
            const normalizedTitle = normalizeSearchText(recipes[id].about.title);
            const normalizedContents = normalizeSearchText(
                deltaToSearchText(recipes[id].contents.text),
            );
            return {
                id,
                normalizedTitle,
                compactTitle: normalizedTitle.replace(/ /g, ''),
                normalizedContents,
                compactContents: normalizedContents.replace(/ /g, ''),
            };
        });

    return {
        actorId,
        recipes,
        documents,
        titleIndex: new Fuse(documents, {
            keys: ['normalizedTitle'],
            includeScore: true,
            ignoreLocation: true,
            threshold: TITLE_FUZZY_THRESHOLD,
        }),
    };
};

const setBestMatch = (matches: { [id: string]: Match }, match: Match) => {
    const current = matches[match.id];
    if (
        current == null ||
        match.tier < current.tier ||
        (match.tier === current.tier && match.score < current.score)
    ) {
        matches[match.id] = match;
    }
};

export const runRecipeSearch = (
    prepared: PreparedRecipeSearch,
    query: string,
): ?RecipeSearchResults => {
    const normalizedQuery = normalizeSearchText(query);
    const compactQuery = normalizedQuery.replace(/ /g, '');
    if (!compactQuery) {
        return null;
    }

    const titleMatches: { [id: string]: Match } = {};
    prepared.documents.forEach((document) => {
        if (document.normalizedTitle.includes(normalizedQuery)) {
            setBestMatch(titleMatches, { id: document.id, tier: 0, score: 0 });
        } else if (document.compactTitle.includes(compactQuery)) {
            setBestMatch(titleMatches, { id: document.id, tier: 1, score: 0 });
        }
    });

    if (compactQuery.length >= MIN_FUZZY_QUERY_LENGTH) {
        prepared.titleIndex.search(normalizedQuery).forEach((result) => {
            setBestMatch(titleMatches, {
                id: result.item.id,
                tier: 2,
                score: result.score == null ? 1 : result.score,
            });
        });
    }

    const compareTitleMatches = (a: Match, b: Match): number =>
        statusRank(prepared.recipes[a.id], prepared.actorId) -
            statusRank(prepared.recipes[b.id], prepared.actorId) ||
        a.tier - b.tier ||
        (a.tier === 2 && b.tier === 2 ? a.score - b.score : 0) ||
        compareBase(prepared.recipes, null, a.id, b.id);

    const sortedTitleMatches = Object.keys(titleMatches)
        .map((id) => titleMatches[id])
        .sort(compareTitleMatches);

    const bodyMatches: Array<Match> = [];
    prepared.documents.forEach((document) => {
        if (titleMatches[document.id] != null) {
            return;
        }
        if (document.normalizedContents.includes(normalizedQuery)) {
            bodyMatches.push({ id: document.id, tier: 0, score: 0 });
        } else if (document.compactContents.includes(compactQuery)) {
            bodyMatches.push({ id: document.id, tier: 1, score: 0 });
        }
    });
    bodyMatches.sort(
        (a, b) =>
            statusRank(prepared.recipes[a.id], prepared.actorId) -
                statusRank(prepared.recipes[b.id], prepared.actorId) ||
            a.tier - b.tier ||
            compareBase(prepared.recipes, null, a.id, b.id),
    );

    return {
        titleMatches: sortedTitleMatches.map((match) => match.id),
        bodyMatches: bodyMatches.map((match) => match.id),
    };
};

export const searchRecipes = (
    recipes: { [id: string]: RecipeT },
    query: string,
    actorId: ?string,
): ?RecipeSearchResults => runRecipeSearch(prepareRecipeSearch(recipes, actorId), query);
