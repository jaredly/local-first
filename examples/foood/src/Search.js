// @flow
import * as React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Fuse from 'fuse.js';

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
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    recipe: {
        width: 180,
        height: 100,
        color: 'inherit',
        // boxShadow: '0 0 2px white',
        border: '1px solid #aaa',
        padding: 16,
        margin: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        // borderRadius: 4,
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

const defaultShowAmount = 30;

const Search = ({ client }: { client: Client<*> }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection(React, client, 'recipes');
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const styles = useStyles();

    const [searchText, setSearchText] = React.useState('');
    const [showUpTo, setShowUpTo] = React.useState(defaultShowAmount);
    const results = useDebounce(() => runSearch(recipes, searchText), null, 300, [searchText]);

    return (
        <div className={styles.container}>
            <TextField
                value={searchText}
                onChange={(evt) => {
                    setSearchText(evt.target.value);
                    setShowUpTo(defaultShowAmount);
                }}
                fullWidth
                label="Search"
                variant="outlined"
                autoFocus
            />
            {results == null ? null : results.length ? (
                <div className={styles.results}>
                    {results.slice(0, showUpTo).map(({ item }) => (
                        <div key={item.id}>
                            <Link
                                to={`/recipe/${item.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                                {item.title}
                            </Link>
                        </div>
                    ))}
                    {results.length > showUpTo ? (
                        <Button onClick={() => setShowUpTo(showUpTo + defaultShowAmount)}>
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

const runSearch = (recipes, needle) => {
    if (!needle.trim()) {
        return null;
    }
    const lowerNeedle = needle.toLowerCase();

    const toSearch = Object.keys(recipes).map((id) => ({
        id: id,
        title: recipes[id].title,
        source: recipes[id].source,
        contents: deltaToString(recipes[id].contents.text),
        // todo allow searching comments?
    }));

    // If there's whitespace, do a fuzzy search
    const exacts =
        lowerNeedle.trim() === lowerNeedle
            ? toSearch.filter(
                  (item) =>
                      item.title.toLowerCase().includes(lowerNeedle) ||
                      item.contents.toLowerCase().includes(lowerNeedle),
              )
            : [];
    if (exacts.length) {
        return exacts
            .sort((a, b) => {
                const aa = a.title.toLowerCase().includes(lowerNeedle) ? 1 : 0;
                const ba = b.title.toLowerCase().includes(lowerNeedle) ? 1 : 0;
                return ba - aa;
            })
            .map((item) => ({ item }));
    }

    const fuse = new Fuse(toSearch, {
        includeScore: true,
        keys: [
            { name: 'title', weight: 1 },
            { name: 'source', weight: 0.2 },
            { name: 'contents', weight: 0.5 },
        ],
    });
    return fuse.search(needle);

    // const results = toSearch.map(item => {
    //     if (item.title.includes(needle)) {
    //         return {item, score: 1}
    //     }
    // })
};

const deltaToString = (delta) =>
    delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

export default Search;
