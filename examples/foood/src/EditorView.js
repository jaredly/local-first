// @flow

import * as React from 'react';
import { useAuthStatus } from '../../shared/Auth';
import type { Client, SyncStatus } from '../../../packages/client-bundle';
import { Route, Link, useRouteMatch, useHistory, useParams } from 'react-router-dom';
import Editor from './Editor';
import { useItem } from '../../../packages/client-react';
import deepEqual from '@birchill/json-equalish';

const EditorView = ({ client, actorId }: { client: Client<*>, actorId: string }) => {
    // const authStatus = useAuthStatus(client)
    const { id } = useParams();
    const history = useHistory();
    const [col, recipe] = useItem(React, client, 'recipes', id);

    if (recipe === false) {
        return null;
    }
    if (!recipe) {
        return <div>Recipe not found</div>;
    }

    return (
        <Editor
            about={recipe.about}
            meta={recipe.contents.meta}
            text={recipe.contents.text}
            status={recipe.statuses[actorId]}
            onSave={async (about, meta, text, status) => {
                for (const key of Object.keys(about)) {
                    if (about[key] !== recipe.about[key]) {
                        await col.setAttribute(recipe.id, ['about', key], about[key]);
                    }
                }
                if (status != recipe.statuses[actorId]) {
                    await col.setAttribute(recipe.id, ['statuses', actorId], status);
                }
                if (
                    !deepEqual(meta, recipe.contents.meta) ||
                    !deepEqual(text.ops, recipe.contents.text.ops)
                ) {
                    // STOPSHIP: handle 'new versions'
                    // Also 'derivations'
                    await col.setAttribute(recipe.id, ['contents'], {
                        ...recipe.contents,
                        text,
                        meta,
                    });
                }

                await col.setAttribute(recipe.id, ['updatedDate'], Date.now());

                history.push(`/recipe/${recipe.id}`);

                // col.updateAttributes(recipe.id, ['about'], about)
                // col.updateAttributes(recipe.id, ['contents'], about)
                // const keys = ['title', 'image', 'source', 'contents'];
                // console.log('saving', recipe);
                // col.save(recipe.id, recipe)
                //     .catch((err) => {
                //         console.error('error', err);
                //     })
                //     .then(() => {
                //         history.push(`/recipe/${id}`);
                //     });
            }}
        />
    );
};

export default EditorView;
