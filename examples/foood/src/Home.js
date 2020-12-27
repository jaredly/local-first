// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';

// TODO: list all *tags*, based on stuff.
// Include a url for importing if you want to be fast
// Also a search bar
// Have foood register itself as a share target too.

// Am I ready for bulk import?
// Seems like I might be.

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    tag: {
        width: 120,
        height: 120,
        color: 'inherit',
        // boxShadow: '0 0 2px white',
        border: '1px solid #aaa',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        // borderRadius: 4,
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
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
    approvedRecipe: {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.primary.light}`,
        // border: `${theme.spacing(1)}px solid ${theme.palette.primary.light}`,
    },
    // recipeWithoutImage: {
    //     padding: 16,
    // },
    // recipeWithImage: {
    //     // position: 'relative',
    //     // backgroundColor: 'rgb(100,100,100)',
    //     // width: 300,
    //     // height: 200,
    //     // color: 'inherit',
    //     // margin: 2,
    //     // display: 'flex',
    //     // flexDirection: 'column',
    //     // justifyContent: 'space-between',
    //     // textDecoration: 'none',
    // },
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
    approvedRecipeTitle: {
        // backgroundColor: theme.palette.primary.dark,
        // color: theme.palette.primary.lighdarkt,
        // textDecorationColor: theme.palette.primary.light,
        // textDecoration: 'underline',
    },
    rejectedRecipeTitle: {
        fontStyle: 'italic',
        textDecoration: 'line-through',
        textDecorationColor: theme.palette.secondary.light,
    },
    tagRecipes: {
        fontSize: '80%',
    },
    // root: {
    //     backgroundColor: theme.palette.background.paper,
    //     overflow: 'hidden',
    // },
    // body: {
    //     padding: theme.spacing(2),
    // },
    // topBar: {
    //     padding: theme.spacing(2),
    //     backgroundColor: theme.palette.primary.light,
    //     color: theme.palette.primary.contrastText,
    // },
}));

const Tag = ({ tag, count }: { tag: TagT, count: number }) => {
    const styles = useStyles();
    return (
        <Link to={'/tag/' + tag.id} className={styles.tag}>
            {tag.text}
            <div className={styles.tagRecipes}>{count} recipes</div>
        </Link>
    );
};

export const useSetTitle = (title: ?string) => {
    React.useEffect(() => {
        if (title != null) {
            document.title = title;
        } else {
            document.title = 'Foood';
        }
    }, [title]);
};

export const sortRecipes = (recipeA, recipeB, actorId) => {
    const statusA = recipeA.statuses[actorId];
    const statusB = recipeB.statuses[actorId];
    if (statusA === statusB) {
        return recipeB.updatedDate - recipeA.updatedDate;
    }
    if (statusA === 'approved') {
        return -1;
    }
    if (statusB === 'approved') {
        return 1;
    }
    if (statusA === 'rejected') {
        return 1;
    }
    if (statusB === 'rejected') {
        return -1;
    }
    return recipeB.updatedDate - recipeA.updatedDate;
};

const Home = ({ client, actorId }: { client: Client<*>, actorId: string }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (recipes[id].trashedDate != null || !recipes[id].tags) return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));

    useSetTitle(
        match.params.tagid && tags[match.params.tagid]
            ? `${tags[match.params.tagid].text} | Foood`
            : 'Foood',
    );

    if (match.params.tagid) {
        const matches = Object.keys(recipes)
            .filter((id) =>
                recipes[id].trashedDate == null && recipes[id].tags
                    ? recipes[id].tags[match.params.tagid] != null
                    : false,
            )
            .sort((a, b) => sortRecipes(recipes[a], recipes[b], actorId));
        const selectedTag = tags[match.params.tagid];
        if (!selectedTag) {
            return <div>Tag not found</div>;
        }
        return (
            <div>
                <Link style={{ color: 'inherit' }} to="/">
                    Home
                </Link>
                <div style={{ display: 'flex', position: 'relative', marginBottom: 8 }}>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 'bold' }}>
                        {selectedTag.text}
                    </div>
                </div>
                <div className={styles.recipes}>
                    {matches.map((id) => (
                        // <Link
                        //     key={id}
                        //     to={`/recipe/${id}/title/${escapeTitle(recipes[id].about.title)}`}
                        //     className={styles.recipe}
                        // >
                        //     {recipes[id].about.title}
                        //     {/* {recipes[id].contents.totalTime}
                        //     {recipes[id].status} */}
                        // </Link>
                        <RecipeBlock actorId={actorId} recipe={recipes[id]} tags={tags} key={id} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <Link to="/latest">Latest Recipes</Link>
            <div className={styles.tags}>
                {tagIds.length === 0 ? 'No tags defined' : null}
                {tagIds.map((id) => (
                    <Tag key={id} count={tagCounts[id]} tag={tags[id]} />
                ))}
            </div>
            {/* {Object.keys(recipes).map((id) => (
                <div>
                    {recipes[id].title}
                    {recipes[id].contents.totalTime}
                    {recipes[id].status}
                </div>
            ))} */}
        </div>
    );
};

const cx = (...args) => args.filter(Boolean).join(' ');

export const RecipeBlock = ({
    actorId,
    recipe,
    tags,
}: {
    actorId: string,
    recipe: RecipeT,
    tags: { [key: string]: TagT },
}) => {
    const styles = useStyles();

    const href = `/recipe/${recipe.id}/title/${escapeTitle(recipe.about.title)}`;

    const status = recipe.statuses[actorId];

    if (recipe.about.image) {
        return (
            <Link
                to={href}
                className={cx(styles.recipe, status ? styles[status + 'Recipe'] : null)}
            >
                <img src={recipe.about.image} className={styles.recipeImage} />
                <div
                    className={cx(
                        styles.recipeTitle,
                        status ? styles[status + 'RecipeTitle'] : null,
                    )}
                >
                    {recipe.about.title}
                </div>
            </Link>
        );
    }

    return (
        <Link to={href} className={cx(styles.recipe, status ? styles[status + 'Recipe'] : null)}>
            <div className={cx(styles.recipeTitle, status ? styles[status + 'RecipeTitle'] : null)}>
                {recipe.about.title}
            </div>
        </Link>
    );
};

const escapeTitle = (title) => title.replace(/[^a-zA-Z0-9_-]+/g, '-');

export default Home;
