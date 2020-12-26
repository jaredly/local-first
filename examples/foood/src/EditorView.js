// @flow

import * as React from 'react';
import { useAuthStatus } from '../../shared/Auth';
import type { Client, SyncStatus } from '../../../packages/client-bundle';
import { Route, Link, useRouteMatch, useHistory, useParams } from 'react-router-dom';
import Editor from './Editor';
import { useItem } from '../../../packages/client-react';

const EditorView = ({ client, actorId }: { client: Client<*>, actorId: string }) => {
    // const authStatus = useAuthStatus(client)
    const { id } = useParams();
    const history = useHistory();
    const [col, recipe] = useItem(React, client, 'recipes', id);

    if (recipe === false) {
        return;
    }
    if (!recipe) {
        return <div>Recipe not found</div>;
    }

    return (
        <Editor
            actorId={actorId}
            onSave={(updatedRecipe) => {
                const keys = ['title', 'image', 'source', 'contents'];
                console.log('saving', recipe);
                col.save(recipe.id, recipe)
                    .catch((err) => {
                        console.error('error', err);
                    })
                    .then(() => {
                        history.push(`/recipe/${id}`);
                    });
            }}
            recipe={recipe}
        />
    );
};

export default EditorView;
