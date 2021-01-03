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
import RecipeBlock from './RecipeBlock';
import Sidebar from './Sidebar';
import { type MealPlan } from '../private-collections';

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

/*

Ok we'r meal planning! We need a page to display all your plans.
And create a new one.
It will show "week of" date picker
*/

const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
};

const MealPlans = ({
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
    const [mealPlansCol, mealPlans] = useCollection<MealPlan, _>(
        React,
        privateClient,
        'weeklyPlans',
    );
    const [newDate, setNewDate] = React.useState(today());
    const history = useHistory();

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
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
            </div>
        </div>
    );
};

export default MealPlans;
