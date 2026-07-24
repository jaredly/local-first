// @flow
import * as React from 'react';

import { LatestView } from './Latest';
import { PublicRecipes, serverUrl } from './publicRecipes';
import { RecipeInner } from './Recipe';
import { RecipeSidebar } from './Sidebar';

const PublicLatest = ({ host }: { host: string }) => {
    const [sidebar, setSidebar] = React.useState(null);

    React.useEffect(() => {
        document.title = 'All Recipes | Foood';
    }, []);

    return (
        <PublicRecipes host={host}>
            {(recipes) => (
                <React.Fragment>
                    <LatestView
                        actorId={null}
                        onSelectRecipe={setSidebar}
                        recipes={recipes}
                        showStatusFilters={false}
                        tags={{}}
                        url={serverUrl(host)}
                    />
                    {sidebar != null && recipes[sidebar] != null ? (
                        <RecipeSidebar id={sidebar} onClose={() => setSidebar(null)}>
                            <RecipeInner
                                editorData={null}
                                recipe={recipes[sidebar]}
                                url={serverUrl(host)}
                            />
                        </RecipeSidebar>
                    ) : null}
                </React.Fragment>
            )}
        </PublicRecipes>
    );
};

export default PublicLatest;
