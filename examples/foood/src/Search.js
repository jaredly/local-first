// @flow
import * as React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT } from '../collections';
import type { Client } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
import { useLocation, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import { sortRecipes } from './Home';
import RecipeBlock from './RecipeBlock';

const useStyles = makeStyles((theme) => ({
    results: {
        marginTop: theme.spacing(2),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    sectionTitle: {
        textAlign: 'center',
        fontWeight: 'bold',
        padding: theme.spacing(2),
    },
    showMoreButton: {
        marginTop: theme.spacing(2),
        marginLeft: 16,
    },
}));

const useDebounce = (fn, initialValue, timer, dependencies) => {
    const [value, setValue] = React.useState(initialValue);
    React.useEffect(() => {
        const id = setTimeout(() => setValue(fn()), timer);
        return () => clearTimeout(id);
    }, dependencies);
    return value;
};

const defaultShowAmount = 15;

const useSetTitle = (title) => {
    React.useEffect(() => {
        document.title = title;
    }, [title]);
};

const comparePublicRecipes = (recipes, a, b) =>
    recipes[b].updatedDate - recipes[a].updatedDate || a.localeCompare(b);

export const SearchView = ({
    recipes,
    tags,
    actorId,
    url,
}: {
    recipes: { [id: string]: RecipeT },
    tags: { [id: string]: TagT },
    actorId: ?string,
    url: string,
}) => {
    const styles = useStyles();
    const history = useHistory();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const searchText = query.get('q') || '';
    const [showUpTo, setShowUpTo] = React.useState(defaultShowAmount);
    const results = useDebounce(
        () => runSearch(recipes, searchText, actorId),
        runSearch(recipes, searchText, actorId),
        300,
        [recipes, searchText, actorId],
    );

    useSetTitle(`Search: ${searchText}`);

    return (
        <div>
            <TextField
                value={searchText}
                onChange={(event) => {
                    const nextQuery = new URLSearchParams(location.search);
                    if (event.target.value) {
                        nextQuery.set('q', event.target.value);
                    } else {
                        nextQuery.delete('q');
                    }
                    const search = nextQuery.toString();
                    history.replace({
                        pathname: location.pathname,
                        search: search ? `?${search}` : '',
                    });
                    setShowUpTo(defaultShowAmount);
                }}
                fullWidth
                label="Search"
                variant="outlined"
                autoFocus
            />
            {results == null ? null : results[0].length || results[1].length ? (
                <div className={styles.results}>
                    {results[0].length ? (
                        <React.Fragment>
                            <div className={styles.sectionTitle}>Title match</div>
                            <div className={styles.recipes}>
                                {results[0].slice(0, showUpTo).map((id) => (
                                    <RecipeBlock
                                        key={id}
                                        url={url}
                                        actorId={actorId || ''}
                                        recipe={recipes[id]}
                                        tags={tags}
                                    />
                                ))}
                            </div>
                        </React.Fragment>
                    ) : null}
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
                                        actorId={actorId || ''}
                                        recipe={recipes[id]}
                                        tags={tags}
                                    />
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
        </div>
    );
};

export const runSearch = (recipes: { [id: string]: RecipeT }, needle: string, actorId: ?string) => {
    if (!needle.trim()) {
        return null;
    }
    const lowerNeedle = needle.toLowerCase();

    const toSearch: Array<{ id: string, lowerTitle: string, contents: string }> = Object.keys(
        recipes,
    )
        .filter(
            (id) =>
                recipes[id].trashedDate == null &&
                (actorId == null || recipes[id].statuses[actorId] !== 'rejected'),
        )
        .map((id) => ({
            id,
            lowerTitle: recipes[id].about.title.toLowerCase(),
            contents: deltaToString(recipes[id].contents.text).toLowerCase(),
        }));

    const sortMatches = (a: string, b: string): number =>
        actorId == null
            ? comparePublicRecipes(recipes, a, b)
            : sortRecipes(recipes[a], recipes[b], actorId) || a.localeCompare(b);

    const titleMatch: Array<string> = toSearch
        .filter((item) => item.lowerTitle.includes(lowerNeedle))
        .map((item) => item.id)
        .sort(sortMatches);
    const bodyMatch: Array<string> = toSearch
        .filter(
            (item) => !item.lowerTitle.includes(lowerNeedle) && item.contents.includes(lowerNeedle),
        )
        .map((item) => item.id)
        .sort(sortMatches);

    return [titleMatch, bodyMatch];
};

const deltaToString = (delta) =>
    delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

const Search = ({ client, actorId, url }: { url: string, client: Client<*>, actorId: string }) => {
    const [, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [, tags] = useCollection<TagT, _>(React, client, 'tags');
    return <SearchView url={url} recipes={recipes} tags={tags} actorId={actorId} />;
};

export default Search;
