// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';

import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import EditIcon from '@material-ui/icons/Edit';
import Star from '@material-ui/icons/Star';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';

import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';
import { NewComment, EditComment } from './EditComment';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import { type Homepage } from '../private-collections';
import type { RecipeT, TagT, RecipeStatus } from '../collections';

const QueueButton = ({ id, client }: { id: string, client: Client<*> }) => {
    const [col, homepage] = useItem<Homepage, _>(React, client, 'homepage', 'default');
    if (homepage == null || !homepage || !homepage.recipeQueue[id]) {
        return (
            <Button
                disabled={homepage === false}
                variant="outlined"
                onClick={() => {
                    if (homepage === false) {
                        return;
                    }
                    if (homepage == null) {
                        col.save('default', {
                            id: 'default',
                            categories: [],
                            recipeQueue: {
                                [id]: {
                                    note: '',
                                    added: Date.now(),
                                },
                            },
                        });
                    } else {
                        col.setAttribute(homepage.id, ['recipeQueue', id], {
                            note: '',
                            added: Date.now(),
                        });
                    }
                }}
            >
                Add to queue
            </Button>
        );
    }
    return (
        <Button
            variant="contained"
            onClick={() => {
                col.clearAttribute(homepage.id, ['recipeQueue', id]);
            }}
        >
            In queue
        </Button>
    );
};

export default QueueButton;
