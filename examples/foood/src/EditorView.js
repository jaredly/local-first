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
            client={client}
            tags={recipe.tags}
            about={recipe.about}
            meta={recipe.contents.meta}
            text={recipe.contents.text}
            status={recipe.statuses[actorId]}
            onCancel={() => {
                history.push(`/recipe/${id}`);
            }}
            onDelete={async () => {
                await col.setAttribute(id, ['trashedDate'], Date.now());
                history.goBack();
            }}
            onSave={async (about, meta, text, status, tags) => {
                for (const key of Object.keys(about)) {
                    if (about[key] !== recipe.about[key]) {
                        await col.setAttribute(recipe.id, ['about', key], about[key]);
                    }
                }
                if (status != recipe.statuses[actorId]) {
                    if (status == null) {
                        await col.clearAttribute(recipe.id, ['statuses', actorId]);
                    } else {
                        await col.setAttribute(recipe.id, ['statuses', actorId], status);
                    }
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

                // Remove old tags
                for (const tid of Object.keys(recipe.tags)) {
                    if (!tags.includes(tid)) {
                        await col.clearAttribute(recipe.id, ['tags', tid]);
                    }
                }
                // Add new tags
                for (const tid of tags) {
                    if (recipe.tags[tid] == null) {
                        await col.setAttribute(recipe.id, ['tags', tid], Date.now());
                    }
                }

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
