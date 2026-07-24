// @flow
import * as React from 'react';
import { useParams } from 'react-router-dom';

import { RecipeInner } from './Recipe';
import { serverUrl } from './publicRecipes';

type PublicRecipeState =
    | { status: 'loading', recipe: null, error: null }
    | { status: 'ready', recipe: *, error: null }
    | { status: 'not-found', recipe: null, error: null }
    | { status: 'error', recipe: null, error: Error };

const useRecipe = (host, id): PublicRecipeState => {
    const [state, setState] = React.useState<PublicRecipeState>({
        status: 'loading',
        recipe: null,
        error: null,
    });

    React.useEffect(() => {
        let active = true;
        setState({ status: 'loading', recipe: null, error: null });
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
            if (active) {
                setState({ status: 'ready', recipe, error: null });
            }
        })().catch((error) => {
            if (active) {
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
