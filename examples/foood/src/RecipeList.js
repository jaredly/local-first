// @flow
import * as React from 'react';
import type { RecipeT, TagT, IngredientT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem, useQuery } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Close from '@material-ui/icons/Close';
import LinkIcon from '@material-ui/icons/Link';

import { imageUrl } from './utils';
import Sidebar from './Sidebar';
import Tag from './Tag';
import { type PantryIngredient } from '../private-collections';

export { Tag };

import RecipeBlock, { getIngredients } from './RecipeBlock';

export const statusOrder = ['favorite', 'approved', 'to try', undefined, null, 'rejected'];

export const sortRecipes = (recipeA: RecipeT, recipeB: RecipeT, actorId: string) => {
    const statusA = statusOrder.indexOf(recipeA.statuses[actorId]);
    const statusB = statusOrder.indexOf(recipeB.statuses[actorId]);
    if (statusA === statusB) {
        return recipeB.updatedDate - recipeA.updatedDate;
    }
    return statusA - statusB;
};
const useStyles = makeStyles((theme) => ({
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
}));

const getMergedIngredient = (ingredients, id, depth = 0) => {
    if (!ingredients[id] || ingredients[id].mergedInto == null || depth > 100) {
        // lol 100 is way too many, but being cautious
        return id;
    }
    return getMergedIngredient(ingredients, ingredients[id].mergedInto, depth + 1);
};

const filterByFilters = (recipe: RecipeT, filters, ingredients, pantryIngredients): boolean => {
    // TODO: determine optionals here!
    const { used } = getIngredients(recipe);
    if (Object.keys(used).length === 0) {
        return false;
    }
    const ids = {};
    Object.keys(used).forEach((id) => {
        ids[getMergedIngredient(ingredients, id)] = true;
    });
    const missing = Object.keys(filters.ingredients).some((id) => !ids[id]);
    if (missing) {
        return false;
    }
    if (filters.vegetarian) {
        const hasMeat = Object.keys(ids).some((id) => ingredients[id]?.kinds['meat'] != null);
        if (hasMeat) {
            return false;
        }
    }
    if (filters.noShopping) {
        const hasShopping = Object.keys(ids).some(
            (id) => pantryIngredients[id].availability === 'rarely',
        );
        if (hasShopping) {
            return false;
        }
    }
    return true;
};

const FilteredRecipeList = ({
    url,
    actorId,
    recipes,
    tags,
    tagId,
    client,
    privateClient,
    setSidebar,
}: {
    setSidebar: (string) => void,
    tags: { [key: string]: TagT },
    recipes: { [key: string]: RecipeT },
    tagId: string,
    client: Client<*>,
    privateClient: Client<*>,
    actorId: string,
    url: string,
}) => {
    const styles = useStyles();
    const [ingredientsCol, ingredients] = useCollection<IngredientT, _>(
        React,
        client,
        'ingredients',
    );
    const [pantryCol, pantryIngredients] = useCollection<PantryIngredient, _>(
        React,
        privateClient,
        'pantryIngredients',
    );

    const [filters, setFilters] = React.useState({
        vegetarian: false,
        noShopping: false,
        ingredients: {},
    });

    const [matches, usedIngredients] = React.useMemo(() => {
        const matches = Object.keys(recipes)
            .filter((id) =>
                filterByFilters(recipes[id], filters, ingredients, pantryIngredients) &&
                recipes[id].trashedDate == null &&
                recipes[id].tags
                    ? recipes[id].tags[tagId] != null
                    : false,
            )
            .sort((a, b) => sortRecipes(recipes[a], recipes[b], actorId));

        const usedIngredients = {};
        // Load up

        return [matches, {}];
    }, [recipes, tagId, actorId, ingredients, pantryIngredients, filters]);

    return (
        <React.Fragment>
            <Button
                variant={filters.vegetarian ? 'contained' : 'text'}
                onClick={() =>
                    setFilters((filters) => ({ ...filters, vegetarian: !filters.vegetarian }))
                }
            >
                Vegetarian
            </Button>
            <Button
                variant={filters.noShopping ? 'contained' : 'text'}
                onClick={() =>
                    setFilters((filters) => ({ ...filters, noShopping: !filters.noShopping }))
                }
            >
                No shopping
            </Button>
            {/* <Filters
                    setFilters={setFilters}
                    filters={filters}
                /> */}
            <div className={styles.recipes}>
                {matches.map((id) => (
                    <RecipeBlock
                        // hmm I should useContext
                        // for url & actorId
                        url={url}
                        actorId={actorId}
                        recipe={recipes[id]}
                        tags={tags}
                        key={id}
                        onClick={() => setSidebar(id)}
                    />
                ))}
            </div>
        </React.Fragment>
    );
};

const RecipeList = ({
    url,
    actorId,
    recipes,
    tags,
    tagId,
    client,
    privateClient,
    setSidebar,
}: {
    setSidebar: (string) => void,
    tags: { [key: string]: TagT },
    recipes: { [key: string]: RecipeT },
    tagId: string,
    client: Client<*>,
    privateClient: Client<*>,
    actorId: string,
    url: string,
}) => {
    const styles = useStyles();

    const matches = Object.keys(recipes)
        .filter((id) =>
            recipes[id].trashedDate == null && recipes[id].tags
                ? recipes[id].tags[tagId] != null
                : false,
        )
        .sort((a, b) => sortRecipes(recipes[a], recipes[b], actorId));

    const [useFilters, setUserFilters] = React.useState(false);

    if (useFilters) {
        return (
            <FilteredRecipeList
                // hmm I should useContext
                // for url & actorId
                url={url}
                actorId={actorId}
                recipes={recipes}
                tags={tags}
                setSidebar={setSidebar}
                tagId={tagId}
                client={client}
                privateClient={privateClient}
            />
        );
    }

    return (
        <React.Fragment>
            <Button variant="contained" onClick={() => setUserFilters(true)}>
                Filter by ingredients
            </Button>
            {/* <Filters
                    setFilters={setFilters}
                    filters={filters}
                /> */}
            <div className={styles.recipes}>
                {matches.map((id) => (
                    <RecipeBlock
                        // hmm I should useContext
                        // for url & actorId
                        url={url}
                        actorId={actorId}
                        recipe={recipes[id]}
                        tags={tags}
                        key={id}
                        onClick={() => setSidebar(id)}
                    />
                ))}
            </div>
        </React.Fragment>
    );
};

export default RecipeList;
