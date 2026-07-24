// @flow
import * as React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT } from '../collections';
import type { Client } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
import { useLocation, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import RecipeBlock from './RecipeBlock';
import {
    normalizeSearchText,
    prepareRecipeSearch,
    runRecipeSearch,
    searchRecipes,
} from './searchRecipes';
import { updateSearchQuery } from './searchQuery';

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
    const searchIndex = React.useMemo(
        () => prepareRecipeSearch(recipes, actorId),
        [recipes, actorId],
    );
    const debouncedResults = useDebounce(
        () => runRecipeSearch(searchIndex, searchText),
        runRecipeSearch(searchIndex, searchText),
        300,
        [searchIndex, searchText],
    );
    const results = normalizeSearchText(searchText) ? debouncedResults : null;

    useSetTitle(`Search: ${searchText}`);

    return (
        <div>
            <TextField
                value={searchText}
                onChange={(event) => {
                    history.replace({
                        pathname: location.pathname,
                        search: updateSearchQuery(location.search, event.target.value),
                    });
                    setShowUpTo(defaultShowAmount);
                }}
                fullWidth
                label="Search"
                variant="outlined"
                autoFocus
            />
            {results == null ? null : results.titleMatches.length || results.bodyMatches.length ? (
                <div className={styles.results}>
                    {results.titleMatches.length ? (
                        <React.Fragment>
                            <div className={styles.sectionTitle}>Title match</div>
                            <div className={styles.recipes}>
                                {results.titleMatches.slice(0, showUpTo).map((id) => (
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
                    {showUpTo > results.titleMatches.length && results.bodyMatches.length > 0 ? (
                        <div className={styles.sectionTitle}>Contents match</div>
                    ) : null}
                    {showUpTo > results.titleMatches.length ? (
                        <div className={styles.recipes}>
                            {results.bodyMatches
                                .slice(0, Math.max(0, showUpTo - results.titleMatches.length))
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
                    {results.titleMatches.length + results.bodyMatches.length > showUpTo ? (
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

export const runSearch = searchRecipes;

const Search = ({ client, actorId, url }: { url: string, client: Client<*>, actorId: string }) => {
    const [, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [, tags] = useCollection<TagT, _>(React, client, 'tags');
    return <SearchView url={url} recipes={recipes} tags={tags} actorId={actorId} />;
};

export default Search;
