// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import { Link } from 'react-router-dom';

import RecipeBlock from './RecipeBlock';
import { PublicRecipes, serverUrl } from './publicRecipes';

const useStyles = makeStyles((theme) => ({
    heading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing(2),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    empty: {
        padding: theme.spacing(4, 0),
    },
}));

const PublicHomeRecipes = ({ recipes, url }) => {
    const styles = useStyles();
    const ids = Object.keys(recipes)
        .filter((id) => recipes[id].trashedDate == null)
        .sort((a, b) => recipes[b].createdDate - recipes[a].createdDate || a.localeCompare(b))
        .slice(0, 15);

    React.useEffect(() => {
        document.title = 'Foood';
    }, []);

    return (
        <div>
            <div className={styles.heading}>
                <h2>Recently added</h2>
                <Button component={Link} to="/latest" color="primary">
                    View all recipes
                </Button>
            </div>
            {ids.length === 0 ? (
                <div className={styles.empty}>No recipes found.</div>
            ) : (
                <div className={styles.recipes}>
                    {ids.map((id) => (
                        <RecipeBlock key={id} actorId="" recipe={recipes[id]} tags={{}} url={url} />
                    ))}
                </div>
            )}
        </div>
    );
};

const PublicHome = ({ host }: { host: string }) => (
    <PublicRecipes host={host}>
        {(recipes) => <PublicHomeRecipes recipes={recipes} url={serverUrl(host)} />}
    </PublicRecipes>
);

export default PublicHome;
