// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import renderQuill from './renderQuill';

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
        fontSize: 20,
        lineHeight: 1.8,
        fontWeight: 300,
    },
    title: {
        fontSize: 44,
        lineHeight: 1,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: "'Abril Fatface', cursive",
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 8,
        fontSize: '60%',
    },
    tag: {
        color: 'inherit',
        marginRight: 8,
        padding: 8,
        display: 'inline-block',
        lineHeight: 1,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        textDecoration: 'none',
    },

    instruction: {
        // cursor: 'pointer',
    },

    instructionGroup: {
        padding: 16,
    },
    ingredientGroup: {
        padding: 16,
    },
    ingredient: {
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
    checkedIngredient: {
        textDecoration: 'line-through',
        textDecorationColor: 'rgba(255,255,255,0.3)',
        opacity: 0.8,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
}));

const formatClass = (format) => {
    if (!format) {
        return null;
    }
    if (format.instruction) {
        return;
    }
};

const useSetTitle = (title) => {
    React.useEffect(() => {
        document.title = title;
    }, [title]);
};

const RecipeView = ({ client }: { client: Client<*> }) => {
    const match = useRouteMatch();
    const { id } = match.params;
    const [col, recipe] = useItem<RecipeT, _>(React, client, 'recipes', id);
    const [_, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();
    const history = useHistory();
    useSetTitle(recipe ? `${recipe.about.title} | Foood` : 'Foood');
    if (recipe === false) {
        return <div />; // wait on it
    }
    if (!recipe) {
        return <div>Recipe not found</div>;
    }
    return (
        <div className={styles.container}>
            <div className={styles.title}>
                {recipe.about.title}
                <IconButton
                    edge="start"
                    // className={styles.menuButton}
                    style={{ marginRight: 16 }}
                    color="inherit"
                    aria-label="menu"
                    href={`/recipe/${recipe.id}/edit`}
                    onClick={(evt) => {
                        if (evt.button == 0 && !evt.ctrlKey && !evt.metaKey) {
                            history.push(`/recipe/${recipe.id}/edit`);
                            evt.preventDefault();
                            evt.stopPropagation();
                        }
                    }}
                >
                    <EditIcon />
                </IconButton>
            </div>
            {recipe.tags != null && Object.keys(recipe.tags).length > 0 ? (
                <div className={styles.tags}>
                    <div style={{ marginRight: 8 }}>Tags:</div>
                    {Object.keys(recipe.tags)
                        .filter((tid) => !!tags[tid])
                        .map((tid) => (
                            <Link to={`/tag/${tid}`} className={styles.tag} key={tid}>
                                {tags[tid].text}
                            </Link>
                        ))}
                </div>
            ) : null}
            <div className={styles.text}>{renderQuill(recipe.contents.text)}</div>
        </div>
    );
};

export default RecipeView;
