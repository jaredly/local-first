// @flow
import * as React from 'react';

import { clientCrdtImpl } from '../../../packages/client-bundle';
import type { RecipeT } from '../collections';

export type PublicRecipesState =
    | { status: 'loading', recipes: { [id: string]: RecipeT }, error: null }
    | { status: 'ready', recipes: { [id: string]: RecipeT }, error: null }
    | { status: 'error', recipes: { [id: string]: RecipeT }, error: Error };

type PublicRecipesCache = {
    host: string,
    recipes: { [id: string]: RecipeT },
    fetchedAt: number,
};

export const publicRecipesMaxAge = 5 * 60 * 1000;

const publicRecipesCaches: Map<string, PublicRecipesCache> = new Map();
const publicRecipesRequests: Map<string, Promise<{ [id: string]: RecipeT }>> = new Map();

export const serverUrl = (host: string) =>
    `${host.startsWith('localhost:') ? 'http' : 'https'}://${host}`;

const isObject = (value: mixed): boolean =>
    value != null && typeof value === 'object' && !Array.isArray(value);

const isRecipe = (value: mixed): boolean => {
    if (!isObject(value)) {
        return false;
    }
    const recipe: any = value;
    return (
        typeof recipe.id === 'string' &&
        isObject(recipe.about) &&
        typeof recipe.about.title === 'string' &&
        isObject(recipe.contents) &&
        isObject(recipe.statuses)
    );
};

export const decodePublicRecipes = (payload: mixed): { [id: string]: RecipeT } => {
    if (!Array.isArray(payload) || payload.length !== 2) {
        throw new Error('Public recipe response must be a [nodes, failed] tuple');
    }
    const [nodes, failed] = payload;
    if (!isObject(nodes) || !isObject(failed)) {
        throw new Error('Public recipe response contains invalid node data');
    }

    const nodeMap: any = nodes;
    const failedMap: any = failed;
    const failedIds = Object.keys(failedMap);
    if (failedIds.length) {
        console.error('Unable to reconstruct some public recipes', failedIds);
    }

    const recipes = {};
    Object.keys(nodeMap).forEach((id) => {
        const value = clientCrdtImpl.value(nodeMap[id]);
        if (!isRecipe(value)) {
            console.error('Ignoring invalid public recipe', id);
            return;
        }
        recipes[value.id] = value;
    });
    return recipes;
};

export const fetchPublicRecipes = async (host: string): Promise<{ [id: string]: RecipeT }> => {
    const response = await fetch(`${serverUrl(host)}/dump/?db=foood/public&collection=recipes`);
    if (!response.ok) {
        throw new Error(`Unable to load public recipes (HTTP ${response.status})`);
    }
    return decodePublicRecipes(await response.json());
};

const cachedRecipesForHost = (host: string): ?PublicRecipesCache => publicRecipesCaches.get(host);

export const cachedPublicRecipe = (
    host: string,
    id: string,
): ?{ recipe: RecipeT, fetchedAt: number } => {
    const cached = cachedRecipesForHost(host);
    const recipe = cached != null ? cached.recipes[id] : null;
    return cached != null && recipe != null ? { recipe, fetchedAt: cached.fetchedAt } : null;
};

export const updateCachedPublicRecipe = (host: string, recipe: RecipeT) => {
    const cached = cachedRecipesForHost(host);
    if (cached != null) {
        publicRecipesCaches.set(host, {
            ...cached,
            recipes: {
                ...cached.recipes,
                [recipe.id]: recipe,
            },
        });
    }
};

const refreshPublicRecipes = (host: string): Promise<{ [id: string]: RecipeT }> => {
    const pending = publicRecipesRequests.get(host);
    if (pending != null) {
        return pending;
    }

    const promise = fetchPublicRecipes(host).then((recipes) => {
        publicRecipesCaches.set(host, {
            host,
            recipes,
            fetchedAt: Date.now(),
        });
        return recipes;
    });
    publicRecipesRequests.set(host, promise);

    const clearRequest = () => {
        if (publicRecipesRequests.get(host) === promise) {
            publicRecipesRequests.delete(host);
        }
    };
    promise.then(clearRequest, clearRequest);
    return promise;
};

export const usePublicRecipes = (host: string): PublicRecipesState => {
    const cached = cachedRecipesForHost(host);
    const [state, setState] = React.useState<PublicRecipesState>(
        cached != null
            ? { status: 'ready', recipes: cached.recipes, error: null }
            : { status: 'loading', recipes: {}, error: null },
    );

    React.useEffect(() => {
        let active = true;
        const currentCache = cachedRecipesForHost(host);
        if (currentCache != null) {
            setState({ status: 'ready', recipes: currentCache.recipes, error: null });
            if (Date.now() - currentCache.fetchedAt < publicRecipesMaxAge) {
                return () => {
                    active = false;
                };
            }
        } else {
            setState({ status: 'loading', recipes: {}, error: null });
        }

        refreshPublicRecipes(host).then(
            (recipes) => {
                if (active) {
                    setState({ status: 'ready', recipes, error: null });
                }
            },
            (error) => {
                if (!active) {
                    return;
                }
                if (currentCache != null) {
                    console.error('Unable to refresh public recipes', error);
                } else {
                    setState({
                        status: 'error',
                        recipes: {},
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            },
        );
        return () => {
            active = false;
        };
    }, [host]);

    return state;
};

export const PublicRecipes = ({
    host,
    children,
}: {
    host: string,
    children: ({ [id: string]: RecipeT }) => React.Node,
}) => {
    const state = usePublicRecipes(host);
    if (state.status === 'loading') {
        return <div>Loading recipes...</div>;
    }
    if (state.status === 'error') {
        return <div>Unable to load recipes. Please try again.</div>;
    }
    return children(state.recipes);
};
