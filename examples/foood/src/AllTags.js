// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
import { makeStyles } from '@material-ui/core/styles';

import Tag from './Tag';
import { useSetTitle } from './Home';

const useStyles = makeStyles(() => ({
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
}));

const AllTags = ({ client, actorId, url }: { client: Client<*>, actorId: string, url: string }) => {
    const [recipesCol, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();

    useSetTitle('All Tags | Foood');

    const recipesByTag = {};
    const tagCounts = {};
    const approvedTagCounts = {};

    Object.keys(recipes).forEach((id) => {
        const recipe = recipes[id];
        if (recipe.trashedDate != null || !recipe.tags) {
            return;
        }
        Object.keys(recipe.tags).forEach((tagId) => {
            tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
            if (recipesByTag[tagId]) {
                recipesByTag[tagId].push(id);
            } else {
                recipesByTag[tagId] = [id];
            }
            if (
                recipe.statuses[actorId] === 'approved' ||
                recipe.statuses[actorId] === 'favorite'
            ) {
                approvedTagCounts[tagId] = (approvedTagCounts[tagId] || 0) + 1;
            }
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) =>
        approvedTagCounts[a] === approvedTagCounts[b]
            ? (tagCounts[b] || 0) - (tagCounts[a] || 0)
            : (approvedTagCounts[b] || 0) - (approvedTagCounts[a] || 0),
    );

    return (
        <div className={styles.tags}>
            {tagIds.length === 0 ? 'No tags defined' : null}
            {tagIds.map((id) => (
                <Tag
                    url={url}
                    actorId={actorId}
                    key={id}
                    approvedCount={approvedTagCounts[id] || 0}
                    matchingRecipes={recipesByTag[id] || []}
                    recipes={recipes}
                    count={tagCounts[id] || 0}
                    tag={tags[id]}
                />
            ))}
        </div>
    );
};

export default AllTags;
