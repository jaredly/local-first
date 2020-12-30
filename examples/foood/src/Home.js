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
    container: {
        paddingTop: theme.spacing(8),
    },

    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    tag: {
        width: 200,
        height: 200,
        color: 'inherit',
        // boxShadow: '0 0 2px white',
        // border: '1px solid #aaa',
        backgroundColor: '#555',
        // padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        position: 'relative',
        '@media(max-width: 600px)': {
            width: '100%',
            height: '100px',
            overflow: 'hidden',
        },
        // borderRadius: 4,
    },
    tagTitle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        fontSize: 20,
        right: 0,
        backgroundColor: 'rgba(50, 50, 50, 0.8)',
        padding: theme.spacing(1),
    },
    tagImages: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
        // height: 100,
        // width: 100,
    },
    tagImage1: {
        margin: 0,
        width: 200,
        height: 200,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            width: '100%',
            height: '100%',
        },
    },
    tagImage2: {
        margin: 0,
        width: 100,
        height: 200,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            width: '50%',
            height: '100%',
        },
    },
    tagImage: {
        margin: 0,
        width: 100,
        height: 100,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            flex: 1,
            height: '100%',
        },
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
    'to-tryRecipe': {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.secondary.light}`,
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

const statusOrder = ['approved', 'to try', undefined, null, 'rejected'];

const Tag = ({
    tag,
    count,
    approvedCount,
    recipes,
    matchingRecipes,
    actorId,
    url,
}: {
    approvedCount: number,
    tag: TagT,
    count: number,
    recipes: { [key: string]: RecipeT },
    matchingRecipes: Array<string>,
    actorId: string,
    url: string,
}) => {
    const styles = useStyles();

    const images = matchingRecipes
        .filter((id) => !!recipes[id].about.image)
        .sort((a, b) => {
            const statusA = statusOrder.indexOf(recipes[a].statuses[actorId]);
            const statusB = statusOrder.indexOf(recipes[b].statuses[actorId]);
            if (statusA === statusB) {
                return recipes[b].updatedDate - recipes[a].updatedDate;
            }
            return statusA - statusB;
        });

    return (
        <Link to={'/tag/' + tag.id} className={styles.tag}>
            <div className={styles.tagImages}>
                {images.slice(0, 4).map((id) => (
                    <img
                        src={imageUrl(recipes[id].about.image, url)}
                        className={
                            images.length === 1
                                ? styles.tagImage1
                                : images.length == 2
                                ? styles.tagImage2
                                : styles.tagImage
                        }
                    />
                ))}
            </div>
            <div className={styles.tagTitle}>
                {tag.text}
                <div className={styles.tagRecipes}>
                    {approvedCount ? `${approvedCount} recipes` : ''}
                    {approvedCount && count > approvedCount ? ', ' : ''}
                    {count > approvedCount ? `${count - approvedCount} pending` : ''}
                </div>
            </div>
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

export const sortRecipes = (recipeA: RecipeT, recipeB: RecipeT, actorId: string) => {
    const statusA = statusOrder.indexOf(recipeA.statuses[actorId]);
    const statusB = statusOrder.indexOf(recipeB.statuses[actorId]);
    if (statusA === statusB) {
        return recipeB.updatedDate - recipeA.updatedDate;
    }
    return statusA - statusB;
};

const Home = ({ client, actorId, url }: { client: Client<*>, actorId: string, url: string }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();
    const history = useHistory();

    const [sidebar, setSidebar] = React.useState(null);

    const recipesByTag = {};

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (recipes[id].trashedDate != null || !recipes[id].tags) return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
            if (!recipesByTag[tid]) {
                recipesByTag[tid] = [id];
            } else {
                recipesByTag[tid].push(id);
            }
        });
    });

    const approvedTagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (
            recipes[id].trashedDate != null ||
            !recipes[id].tags ||
            recipes[id].statuses[actorId] !== 'approved'
        )
            return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            approvedTagCounts[tid] = (approvedTagCounts[tid] || 0) + 1;
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) =>
        approvedTagCounts[a] === approvedTagCounts[b]
            ? (tagCounts[b] || 0) - (tagCounts[a] || 0)
            : (approvedTagCounts[b] || 0) - (approvedTagCounts[a] || 0),
    );

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
                        <RecipeBlock
                            url={url}
                            actorId={actorId}
                            recipe={recipes[id]}
                            tags={tags}
                            key={id}
                            onClick={() => setSidebar(id)}
                        />
                    ))}
                </div>
                {sidebar != null ? (
                    <Sidebar
                        onClose={() => setSidebar(null)}
                        id={sidebar}
                        client={client}
                        actorId={actorId}
                        url={url}
                    />
                ) : null}
            </div>
        );
    }

    return (
        <div>
            <Link to="/latest">Latest Recipes</Link>
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

export const minWidthForSidebar = 800;

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

const escapeTitle = (title) => title.replace(/[^a-zA-Z0-9_-]+/g, '-');

export default Home;
