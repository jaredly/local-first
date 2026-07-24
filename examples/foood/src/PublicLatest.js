// @flow
import * as React from 'react';

import { LatestView } from './Latest';
import { PublicRecipes, serverUrl } from './publicRecipes';

const PublicLatest = ({ host }: { host: string }) => {
    React.useEffect(() => {
        document.title = 'All Recipes | Foood';
    }, []);

    return (
        <PublicRecipes host={host}>
            {(recipes) => (
                <LatestView
                    actorId={null}
                    recipes={recipes}
                    showStatusFilters={false}
                    tags={{}}
                    url={serverUrl(host)}
                />
            )}
        </PublicRecipes>
    );
};

export default PublicLatest;
