// @flow
// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import LinkIcon from '@material-ui/icons/Link';

import { imageUrl } from './utils';
import Sidebar from './Sidebar';

const useStyles = makeStyles((theme) => ({
    recipe: {
        position: 'relative',
        width: 270,
        height: 200,
        color: 'inherit',
        margin: theme.spacing(1),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        backgroundColor: 'rgb(100,100,100)',
        // borderRadius: 4,
    },
    'to-tryRecipe': {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.secondary.light}`,
    },
    approvedRecipe: {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.primary.light}`,
    },
    recipeImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    recipeTitle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(50,50,50,0.7)',
        padding: theme.spacing(1),
    },
    approvedRecipeTitle: {},
    rejectedRecipeTitle: {
        fontStyle: 'italic',
        textDecoration: 'line-through',
        textDecorationColor: theme.palette.secondary.light,
    },
    tagRecipes: {
        fontSize: '80%',
    },
}));

export const minWidthForSidebar = 800;

const cx = (...args) => args.filter(Boolean).join(' ');

const escapeTitle = (title) => title.replace(/[^a-zA-Z0-9_-]+/g, '-');

export const RecipeBlock = ({
    actorId,
    recipe,
    tags,
    url,
    onClick,
}: {
    actorId: string,
    recipe: RecipeT,
    tags: { [key: string]: TagT },
    url: string,
    onClick?: () => mixed,
}) => {
    const styles = useStyles();

    const href = `/recipe/${recipe.id}/title/${escapeTitle(recipe.about.title)}`;

    const status = recipe.statuses[actorId];

    const onLinkClick = (evt) => {
        if (onClick && window.innerWidth >= minWidthForSidebar) {
            evt.preventDefault();
            onClick();
        } else {
            // let it pass
        }
    };

    if (recipe.about.image) {
        return (
            <Link
                to={href}
                onClick={onLinkClick}
                className={cx(
                    styles.recipe,
                    status ? styles[status.replace(' ', '-') + 'Recipe'] : null,
                )}
            >
                <img src={imageUrl(recipe.about.image, url)} className={styles.recipeImage} />
                <div
                    className={cx(
                        styles.recipeTitle,
                        status ? styles[status.replace(' ', '-') + 'RecipeTitle'] : null,
                    )}
                >
                    {recipe.about.title}
                </div>
            </Link>
        );
    }

    return (
        <Link
            to={href}
            onClick={onLinkClick}
            className={cx(
                styles.recipe,
                status ? styles[status.replace(' ', '-') + 'Recipe'] : null,
            )}
        >
            <div
                className={cx(
                    styles.recipeTitle,
                    status ? styles[status.replace(' ', '-') + 'RecipeTitle'] : null,
                )}
            >
                {recipe.about.title}
            </div>
        </Link>
    );
};

export default RecipeBlock;
