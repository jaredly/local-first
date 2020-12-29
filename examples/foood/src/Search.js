// @flow
import * as React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useLocation, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Fuse from 'fuse.js';
import { sortRecipes, RecipeBlock } from './Home';

// TODO: list all *tags*, based on stuff.
// Include a url for importing if you want to be fast
// Also a search bar
// Have foood register itself as a share target too.

// Am I ready for bulk import?
// Seems like I might be.

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
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
    sectionTitle: {
        textAlign: 'center',
        fontWeight: 'bold',
        padding: theme.spacing(2),
    },
    results: {
        marginTop: theme.spacing(2),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    showMoreButton: {
        marginTop: theme.spacing(2),
        marginLeft: 16,
    },
    recipeTitle: {
        padding: '8px 16px',
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        '&:hover': {
            backgroundColor: `rgba(255,255,255,0.1)`,
        },
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

const useDebounce = (fn, initialValue, timer, uniquifier) => {
    const [value, setValue] = React.useState(initialValue);
    // const tid = React.useRef(null)
    React.useEffect(() => {
        console.log('set up');
        // clearTimeout(tid.current)
        const id = setTimeout(() => {
            console.log('bounced');
            setValue(fn());
        }, timer);
        return () => clearTimeout(id);
    }, uniquifier);
    return value;
};

const defaultShowAmount = 15;

// A custom hook that builds on useLocation to parse
// the query string for you.
function useQuery() {
    return new URLSearchParams(useLocation().search);
}

const useSetTitle = (title) => {
    React.useEffect(() => {
        document.title = title;
    }, [title]);
};

const Search = ({ client, actorId, url }: { url: string, client: Client<*>, actorId: string }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();
    const history = useHistory();

    const query = useQuery();
    const searchText = query.get('q') || '';

    // const [searchText, setSearchText] = React.useState('');
    const [showUpTo, setShowUpTo] = React.useState(defaultShowAmount);
    const results = useDebounce(
        () => runSearch(recipes, searchText, actorId),
        () => runSearch(recipes, searchText, actorId),
        300,
        [recipes, searchText],
    );

    useSetTitle(`Search: ${searchText}`);

    return (
        <div className={styles.container}>
            <TextField
                value={searchText}
                onChange={(evt) => {
                    history.replace(match.path + '?q=' + evt.target.value);
                    setShowUpTo(defaultShowAmount);
                }}
                fullWidth
                label="Search"
                variant="outlined"
                autoFocus
            />
            {results == null ? null : results[0].length ? (
                <div className={styles.results}>
                    <div className={styles.sectionTitle}>Title match</div>
                    <div className={styles.recipes}>
                        {results[0].slice(0, showUpTo).map((id) => (
                            <RecipeBlock
                                key={id}
                                url={url}
                                actorId={actorId}
                                recipe={recipes[id]}
                                tags={tags}
                            />
                            // <div key={id} className={styles.recipe}>
                            //     <Link to={`/recipe/${id}`} className={styles.recipeTitle}>
                            //         {recipes[id].title}
                            //     </Link>
                            // </div>
                        ))}
                    </div>
                    {showUpTo > results[0].length && results[1].length > 0 ? (
                        <div className={styles.sectionTitle}>Contents match</div>
                    ) : null}
                    {showUpTo > results[0].length ? (
                        <div className={styles.recipes}>
                            {results[1]
                                .slice(0, Math.max(0, showUpTo - results[0].length))
                                .map((id) => (
                                    <RecipeBlock
                                        key={id}
                                        url={url}
                                        actorId={actorId}
                                        recipe={recipes[id]}
                                        tags={tags}
                                    />
                                    // <div key={id} className={styles.recipe}>
                                    //     <Link to={`/recipe/${id}`} className={styles.recipeTitle}>
                                    //         {recipes[id].title}
                                    //     </Link>
                                    // </div>
                                ))}
                        </div>
                    ) : null}
                    {results[0].length + results[1].length > showUpTo ? (
                        <Button
                            onClick={() => setShowUpTo(showUpTo + defaultShowAmount)}
                            className={styles.showMoreButton}
                        >
                            Show more
                        </Button>
                    ) : null}
                </div>
            ) : (
                'No results'
            )}
            {/* <div className={styles.tags}>
                {tagIds.length === 0 ? 'No tags defined' : null}
                {tagIds.map((id) => (
                    <Tag key={id} count={tagCounts[id]} tag={tags[id]} />
                ))}
            </div> */}
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

const runSearch = (recipes, needle, actorId) => {
    if (!needle.trim()) {
        return null;
    }
    const lowerNeedle = needle.toLowerCase();

    const toSearch = Object.keys(recipes)
        .filter(
            (id) => recipes[id].trashedDate == null && recipes[id].statuses[actorId] !== 'rejected',
        )
        .map((id) => ({
            id: id,
            title: recipes[id].about.title,
            lowerTitle: recipes[id].about.title.toLowerCase(),
            // source: recipes[id].about.source,
            contents: deltaToString(recipes[id].contents.text).toLowerCase(),
            // status: recipes[id].statuses[actorId]
        }));

    // TODO(jared): Maybe bring this back? idk what I really want.
    const titleMatch = toSearch
        .filter((item) => item.lowerTitle.includes(lowerNeedle))
        .map((item) => item.id)
        .sort((a, b) => sortRecipes(recipes[a], recipes[b], actorId));
    const bodyMatch = toSearch
        .filter(
            (item) => !item.lowerTitle.includes(lowerNeedle) && item.contents.includes(lowerNeedle),
        )
        .map((item) => item.id)
        .sort((a, b) => sortRecipes(recipes[a], recipes[b], actorId));

    return [titleMatch, bodyMatch];

    // return exacts
    //     .sort((a, b) => {
    //         const aa = a.title.toLowerCase().includes(lowerNeedle) ? 1 : 0;
    //         const ba = b.title.toLowerCase().includes(lowerNeedle) ? 1 : 0;
    //         return ba - aa;
    //     })
    //     .map((item) => ({ item }));
};

const deltaToString = (delta) =>
    delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

export default Search;
