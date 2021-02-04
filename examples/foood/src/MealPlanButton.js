// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem, useQuery } from '../../../packages/client-react';

import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import EditIcon from '@material-ui/icons/Edit';
import DateRange from '@material-ui/icons/DateRange';
import Star from '@material-ui/icons/Star';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';

import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';
import { NewComment, EditComment } from './EditComment';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import { type Homepage, type MealPlan } from '../private-collections';
import type { RecipeT, TagT, RecipeStatus } from '../collections';

const DAY_MS = 60 * 1000 * 60 * 24;

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },

    mealPlan: {
        padding: 24,
    },
}));

const twoWeeksAgo = () => {
    const date = new Date(Date.now() - DAY_MS * 10);
    return `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

const MealPlanButton = ({
    recipeId,
    privateClient,
}: {
    recipeId: string,
    privateClient: Client<*>,
}) => {
    const [col, results] = useQuery<MealPlan, _>(
        React,
        privateClient,
        'weeklyPlans',
        'id',
        '>',
        twoWeeksAgo(),
    );
    const styles = useStyles();
    results.sort((a, b) => cmp(b.key, a.key));

    if (!results.length || !results[0].value.uncategorizedRecipes[recipeId]) {
        return (
            <Tooltip title="Add to meal plan">
                <span>
                    <Button
                        disabled={!results.length}
                        style={{ marginLeft: 8 }}
                        variant="outlined"
                        onClick={() => {
                            col.setAttribute(
                                results[0].value.id,
                                ['uncategorizedRecipes', recipeId],
                                Date.now(),
                            );
                        }}
                    >
                        <DateRange />
                    </Button>
                </span>
            </Tooltip>
        );
    }
    return (
        <Tooltip title="Remove from meal plan">
            <Button
                variant="contained"
                style={{ marginLeft: 8 }}
                onClick={() => {
                    col.clearAttribute(results[0].value.id, ['uncategorizedRecipes', recipeId]);
                }}
            >
                <DateRange />
            </Button>
        </Tooltip>
    );
};

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export default MealPlanButton;
