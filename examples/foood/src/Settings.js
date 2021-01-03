// @flow
import * as React from 'react';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useHistory, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import Edit from '@material-ui/icons/Edit';

import { useSetTitle } from './Home';
import RecipeBlock from './RecipeBlock';
import Sidebar from './Sidebar';
import { type MealPlan, type Settings } from '../private-collections';

import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

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

const mealTimes = ['dinner', 'lunch', 'breakfast', 'snack', 'dessert'];

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
    const history = useHistory();

    const [_, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [__, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');

    const [editing, setEditing] = React.useState(null);

    const [settingsCol, settings] = useItem<Settings, _>(
        React,
        privateClient,
        'settings',
        'default',
    );

    if (settings === false) {
        return null; // loading
    }

    if (!settings) {
        return (
            <p>
                No settings set up yet. Go to <Link to="/plans">Meal Plans</Link> to get started
            </p>
        );
    }

    if (editing) {
        return (
            <TagsChooser
                tags={tags}
                recipes={recipes}
                actorId={actorId}
                name={editing}
                initial={settings[editing + 'Tags']}
                onChoose={async (newTags) => {
                    await settingsCol.setAttribute('default', [editing + 'Tags'], newTags);
                    setEditing(null);
                }}
            />
        );
    }

    return (
        <div>
            {mealTimes.map((key) => (
                <div key={key}>
                    <h3>
                        Tags for {key}
                        <IconButton
                            edge="start"
                            style={{ marginLeft: 16 }}
                            color="inherit"
                            onClick={(evt) => {
                                setEditing(key);
                            }}
                        >
                            <Edit />
                        </IconButton>
                    </h3>
                    {Object.keys(settings[key + 'Tags']).map((tid) => (
                        <div key={tid}>{tags[tid].text}</div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export const TagsChooser = ({
    initial,
    tags,
    recipes,
    onChoose,
    actorId,
    name,
}: {
    initial: { [key: string]: number },
    tags: { [key: string]: TagT },
    recipes: { [key: string]: RecipeT },
    onChoose: ({ [key: string]: number }) => mixed,
    actorId: string,
    name: string,
}) => {
    const [selectedTags, setSelectedTags] = React.useState(initial);

    const recipesByTag = {};

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (recipes[id].trashedDate != null || !recipes[id].tags) return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
            if (!recipesByTag[tid]) {
                recipesByTag[tid] = [id];
            } else {
                recipesByTag[tid].push(id);
            }
        });
    });

    const approvedTagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (
            recipes[id].trashedDate != null ||
            !recipes[id].tags ||
            recipes[id].statuses[actorId] !== 'approved'
        )
            return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            approvedTagCounts[tid] = (approvedTagCounts[tid] || 0) + 1;
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) =>
        approvedTagCounts[a] === approvedTagCounts[b]
            ? (tagCounts[b] || 0) - (tagCounts[a] || 0)
            : (approvedTagCounts[b] || 0) - (approvedTagCounts[a] || 0),
    );

    const count = Object.keys(selectedTags).length;

    return (
        <div>
            <h2>What tags should be used when planning for {name}?</h2>
            <Button
                onClick={() => {
                    const data = {};
                    Object.keys(selectedTags).forEach((t) => {
                        if (selectedTags[t]) {
                            data[t] = 1;
                        }
                    });
                    onChoose(data);
                }}
            >
                {count === 0 ? 'Skip' : `Select ${count} tags`}
            </Button>
            {tagIds.map((id) => (
                <div key={id}>
                    {/* {tags[id].text} */}

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!selectedTags[id]}
                                onChange={() => {
                                    setSelectedTags((selectedTags) => ({
                                        ...selectedTags,
                                        [id]: !selectedTags[id],
                                    }));
                                }}
                            />
                        }
                        label={`${tags[id].text} (${approvedTagCounts[id] || 0} approved recipes, ${
                            tagCounts[id] || 0
                        } total)`}
                    />
                </div>
            ))}
        </div>
    );
};

export default MealPlans;
