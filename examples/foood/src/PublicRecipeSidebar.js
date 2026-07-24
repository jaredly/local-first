// @flow
import * as React from 'react';

import type { RecipeT } from '../collections';
import { RecipeInner } from './Recipe';
import { RecipeSidebar } from './Sidebar';

const PublicRecipeSidebar = ({
    id,
    recipes,
    url,
    onClose,
}: {
    id: ?string,
    recipes: { [id: string]: RecipeT },
    url: string,
    onClose: () => mixed,
}) => {
    if (id == null || recipes[id] == null) {
        return null;
    }

    return (
        <RecipeSidebar id={id} onClose={onClose}>
            <RecipeInner editorData={null} recipe={recipes[id]} url={url} />
        </RecipeSidebar>
    );
};

export default PublicRecipeSidebar;
