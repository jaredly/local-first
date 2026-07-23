// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import { type Homepage } from '../private-collections';
import type { Client } from '../../../packages/client-bundle';
import { useCollection, useItem, useQuery } from '../../../packages/client-react';
import { Link, useRouteMatch } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

import Sidebar from './Sidebar';
import Tag from './Tag';
import RecipeList, { sortRecipes, statusOrder } from './RecipeList';

export { Tag, RecipeList, sortRecipes, statusOrder };

import RecipeBlock from './RecipeBlock';

const useStyles = makeStyles((theme) => ({
    mealPlan: {
        padding: 24,
    },
    section: {
        padding: theme.spacing(2, 0),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    sectionTitle: {
        textAlign: 'center',
        marginBottom: theme.spacing(1),
    },
}));

const RECENT_RECIPE_LIMIT = 10;

export const getRecentlyViewedRecipeIds = (
    recipes: { [id: string]: RecipeT },
    recentRecipes: { [id: string]: number },
    limit: number = RECENT_RECIPE_LIMIT,
): Array<string> =>
    Object.keys(recentRecipes)
        .filter((id) => recipes[id] != null && recipes[id].trashedDate == null)
        .sort((a, b) => recentRecipes[b] - recentRecipes[a] || (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, limit);

export const getRecentlyUpdatedRecipeIds = (
    recipes: { [id: string]: RecipeT },
    limit: number = RECENT_RECIPE_LIMIT,
): Array<string> =>
    Object.keys(recipes)
        .filter((id) => recipes[id].trashedDate == null)
        .sort(
            (a, b) =>
                recipes[b].updatedDate - recipes[a].updatedDate || (a < b ? -1 : a > b ? 1 : 0),
        )
        .slice(0, limit);

export const useSetTitle = (title: ?string) => {
    React.useEffect(() => {
        if (title != null) {
            document.title = title;
        } else {
            document.title = 'Foood';
        }
    }, [title]);
};

const Home = ({
    client,
    privateClient,
    actorId,
    url,
}: {
    client: Client<*>,
    privateClient: Client<*>,
    actorId: string,
    url: string,
}) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [homepageCol, homepage] = useItem<Homepage, _>(
        React,
        privateClient,
        'homepage',
        'default',
    );

    const [sidebar, setSidebar] = React.useState(null);

    useSetTitle(
        match.params.tagid && tags[match.params.tagid]
            ? `${tags[match.params.tagid].text} | Foood`
            : 'Foood',
    );

    if (match.params.tagid) {
        const selectedTag = tags[match.params.tagid];
        if (!selectedTag) {
            return <div>Tag not found</div>;
        }
        // TODO: common ingredients
        // Also: ingredient deletion / merging
        // ok done with that one.
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
                <RecipeList
                    url={url}
                    tagId={match.params.tagid}
                    actorId={actorId}
                    recipes={recipes}
                    tags={tags}
                    setSidebar={setSidebar}
                    client={client}
                    privateClient={privateClient}
                />
                {sidebar != null ? (
                    <Sidebar
                        onClose={() => setSidebar(null)}
                        id={sidebar}
                        client={client}
                        privateClient={privateClient}
                        actorId={actorId}
                        url={url}
                    />
                ) : null}
            </div>
        );
    }

    const recentlyViewedIds = getRecentlyViewedRecipeIds(
        recipes,
        homepage && homepage !== false && homepage.recentRecipes ? homepage.recentRecipes : {},
    );
    const recentlyUpdatedIds = getRecentlyUpdatedRecipeIds(recipes);

    return (
        <div>
            <CurrentMealPlan
                url={url}
                actorId={actorId}
                tags={tags}
                setSidebar={setSidebar}
                privateClient={privateClient}
                client={client}
                recipes={recipes}
            />
            {recentlyViewedIds.length > 0 ? (
                <RecentRecipeSection
                    title="Recently viewed"
                    ids={recentlyViewedIds}
                    recipes={recipes}
                    tags={tags}
                    url={url}
                    actorId={actorId}
                    setSidebar={setSidebar}
                />
            ) : null}
            {recentlyUpdatedIds.length > 0 ? (
                <RecentRecipeSection
                    title="Recently added or updated"
                    ids={recentlyUpdatedIds}
                    recipes={recipes}
                    tags={tags}
                    url={url}
                    actorId={actorId}
                    setSidebar={setSidebar}
                />
            ) : null}
            {sidebar != null ? (
                <Sidebar
                    onClose={() => setSidebar(null)}
                    privateClient={privateClient}
                    id={sidebar}
                    client={client}
                    actorId={actorId}
                    url={url}
                />
            ) : null}
        </div>
    );
};

const RecentRecipeSection = ({ title, ids, recipes, tags, url, actorId, setSidebar }) => {
    const styles = useStyles();
    return (
        <section className={styles.section}>
            <Typography className={styles.sectionTitle} variant="h4">
                {title}
            </Typography>
            <div className={styles.recipes}>
                {ids.map((id) => (
                    <RecipeBlock
                        key={id}
                        url={url}
                        actorId={actorId}
                        recipe={recipes[id]}
                        tags={tags}
                        onClick={() => setSidebar(id)}
                    />
                ))}
            </div>
        </section>
    );
};

const DAY_MS = 60 * 1000 * 60 * 24;

const twoWeeksAgo = () => {
    const date = new Date(Date.now() - DAY_MS * 10);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
        .getDate()
        .toString()
        .padStart(2, '0')}`;
};

const CurrentMealPlan = ({ recipes, client, privateClient, url, actorId, tags, setSidebar }) => {
    const [col, results] = useQuery(React, privateClient, 'weeklyPlans', 'id', '>', twoWeeksAgo());
    const styles = useStyles();
    if (!results.length) {
        return null;
    }
    results.sort((a, b) => cmp(b.key, a.key));
    const plan = results[0].value;
    return (
        <div className={styles.mealPlan}>
            <Link to={`/plans/${plan.id}/edit`}>
                <Typography style={{ textAlign: 'center' }} variant="h4">
                    Meal plan for {plan.id}
                </Typography>
            </Link>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {Object.keys(plan.uncategorizedRecipes).map((key) => (
                    <RecipeBlock
                        key={key}
                        url={url}
                        actorId={actorId}
                        recipe={recipes[key]}
                        tags={tags}
                        onClick={() => setSidebar(key)}
                    />
                ))}
            </div>
        </div>
    );
};

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export default Home;
