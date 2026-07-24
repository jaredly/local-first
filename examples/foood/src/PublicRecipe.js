// @flow
import * as React from 'react';
import { useParams } from 'react-router-dom';

import type { RecipeT } from '../collections';
import { RecipeInner } from './Recipe';
import {
    cachedPublicRecipe,
    publicRecipesMaxAge,
    serverUrl,
    updateCachedPublicRecipe,
} from './publicRecipes';

type PublicRecipeState =
    | { status: 'loading', recipe: null, error: null }
    | { status: 'ready', recipe: RecipeT, error: null }
    | { status: 'not-found', recipe: null, error: null }
    | { status: 'error', recipe: null, error: Error };

const useRecipe = (host, id): PublicRecipeState => {
    const initialCachedRecipe = cachedPublicRecipe(host, id);
    const [state, setState] = React.useState<PublicRecipeState>(
        initialCachedRecipe != null
            ? { status: 'ready', recipe: initialCachedRecipe.recipe, error: null }
            : { status: 'loading', recipe: null, error: null },
    );

    React.useEffect(() => {
        let active = true;
        const currentCachedRecipe = cachedPublicRecipe(host, id);
        if (currentCachedRecipe != null) {
            setState({ status: 'ready', recipe: currentCachedRecipe.recipe, error: null });
            if (Date.now() - currentCachedRecipe.fetchedAt < publicRecipesMaxAge) {
                return () => {
                    active = false;
                };
            }
        } else {
            setState({ status: 'loading', recipe: null, error: null });
        }

        (async () => {
            const response = await fetch(
                `${serverUrl(host)}/latest/?db=foood/public&id=${encodeURIComponent(
                    id,
                )}&collection=recipes`,
            );
            if (response.status === 404) {
                if (active) {
                    setState({ status: 'not-found', recipe: null, error: null });
                }
                return;
            }
            if (!response.ok) {
                throw new Error(`Unable to load recipe (HTTP ${response.status})`);
            }
            const recipe = await response.json();
            updateCachedPublicRecipe(host, recipe);
            if (active) {
                setState({ status: 'ready', recipe, error: null });
            }
        })().catch((error) => {
            if (!active) {
                return;
            }
            if (currentCachedRecipe != null) {
                console.error('Unable to refresh public recipe', error);
            } else {
                setState({
                    status: 'error',
                    recipe: null,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }
        });
        return () => {
            active = false;
        };
    }, [host, id]);

    return state;
};

const PublicRecipe = ({ host }: { host: string }) => {
    const { id } = useParams();
    const state = useRecipe(host, id);

    React.useEffect(() => {
        document.title = state.status === 'ready' ? `${state.recipe.about.title} | Foood` : 'Foood';
    }, [state]);

    if (state.status === 'loading') {
        return <div>Loading recipe...</div>;
    }
    if (state.status === 'not-found') {
        return <div>Recipe not found.</div>;
    }
    if (state.status === 'error') {
        return <div>Unable to load this recipe. Please try again.</div>;
    }
    return <RecipeInner url={serverUrl(host)} editorData={null} recipe={state.recipe} />;
};

export default PublicRecipe;
