// @flow
import * as React from 'react';

import { LatestView } from './Latest';
import { PublicRecipes, serverUrl } from './publicRecipes';
import PublicRecipeSidebar from './PublicRecipeSidebar';

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
                    <PublicRecipeSidebar
                        id={sidebar}
                        recipes={recipes}
                        url={serverUrl(host)}
                        onClose={() => setSidebar(null)}
                    />
                </React.Fragment>
            )}
        </PublicRecipes>
    );
};

export default PublicLatest;
