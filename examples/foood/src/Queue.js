// @flow
import * as React from 'react';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useHistory, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';

import { useSetTitle } from './Home';
import { LoadRecipeBlock } from './RecipeBlock';
import Sidebar from './Sidebar';
import { type Homepage } from '../private-collections';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
}));

const Queue = ({
    client,
    privateClient,
    actorId,
    url,
}: {
    url: string,
    privateClient: Client<*>,
    client: Client<*>,
    actorId: string,
}) => {
    const [col, homepage] = useItem<Homepage, _>(React, privateClient, 'homepage', 'default');
    // const [newDate, setNewDate] = React.useState(today());
    const history = useHistory();

    if (homepage === false) {
        return <div>Loading...</div>;
    }
    if (homepage == null) {
        return (
            <div>
                You don't have a recipe queue set up! Click here to set it up.
                <Button
                    variant="contained"
                    style={{ display: 'block', margin: 16 }}
                    onClick={() => {
                        col.save('default', {
                            id: 'default',
                            categories: [],
                            recipeQueue: {},
                        });
                    }}
                >
                    Set up my queue
                </Button>
            </div>
        );
    }

    const ids = Object.keys(homepage.recipeQueue);
    if (ids.length === 0) {
        return <div>No recipes in your queue yet! Go to a recipe, and click "add to queue".</div>;
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
            }}
        >
            {Object.keys(homepage.recipeQueue).map((id) => (
                <LoadRecipeBlock actorId={actorId} url={url} client={client} key={id} id={id} />
            ))}
            {/* <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <TextField
                    label="Start of Week"
                    type="date"
                    value={newDate}
                    onChange={(evt) => setNewDate(evt.target.value)}
                    InputLabelProps={{
                        shrink: true,
                    }}
                />
                <div style={{ width: 16 }} />
                <Button
                    variant="contained"
                    onClick={async () => {
                        const id = newDate;
                        await mealPlansCol.save(id, {
                            id,
                            uncategorizedRecipes: {},
                            meals: {},
                        });
                        history.push(`/plans/${id}/edit`);
                    }}
                >
                    Create new meal plan
                </Button>
            </div>
            <div style={{ padding: 16 }}>
                {Object.keys(mealPlans)
                    .sort()
                    .map((key) => (
                        <div key={key}>
                            <Link to={`/plans/${key}/edit`}>Week of {key}</Link>
                        </div>
                    ))}
                {Object.keys(mealPlans).length === 0 ? 'No meal plans' : null}
            </div> */}
        </div>
    );
};

export default Queue;
