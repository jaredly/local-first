// @flow
import * as React from 'react';

import { SearchView } from './Search';
import { PublicRecipes, serverUrl } from './publicRecipes';

const PublicSearch = ({ host }: { host: string }) => (
    <PublicRecipes host={host}>
        {(recipes) => (
            <SearchView actorId={null} recipes={recipes} tags={{}} url={serverUrl(host)} />
        )}
    </PublicRecipes>
);

export default PublicSearch;
