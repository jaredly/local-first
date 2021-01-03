// @flow
import * as React from 'react';
import type { RecipeT, IngredientT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';

import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

import { useSetTitle } from './Home';
import RecipeBlock from './RecipeBlock';
import Sidebar from './Sidebar';
import { type MealPlan, type PantryIngredient, type Settings } from '../private-collections';
import { Tag } from './Home';
import { DeleteButton } from './Editor';
import { TagsChooser } from './Settings';

import { generateRecipes } from './randomRecipes';

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

const TagSelector = ({ tags, recipes, actorId, onSelect, url }) => {
    const recipesByTag = {};

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (
            recipes[id].trashedDate != null ||
            !recipes[id].tags ||
            !recipes[id].statuses[actorId] ||
            recipes[id].statuses[actorId] === 'rejected'
        )
            return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
            if (!recipesByTag[tid]) {
                recipesByTag[tid] = [id];
            } else {
                recipesByTag[tid].push(id);
            }
        });
    });

    const tagIds = Object.keys(tagCounts).sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {tagIds.length === 0 ? 'No tags defined' : null}
            {tagIds.map((id) => (
                <Tag
                    url={url}
                    actorId={actorId}
                    key={id}
                    approvedCount={tagCounts[id] || 0}
                    matchingRecipes={recipesByTag[id] || []}
                    recipes={recipes}
                    count={tagCounts[id] || 0}
                    tag={tags[id]}
                    onClick={() => onSelect(id)}
                />
            ))}
        </div>
    );
};

const RecipeSelector = ({ tid, tags, recipes, actorId, onSelect, url }) => {
    const recipesByTag = {};

    const recipeIds = Object.keys(recipes).filter(
        (id) =>
            recipes[id].tags &&
            recipes[id].tags[tid] != null &&
            ['to try', 'approved'].includes(recipes[id].statuses[actorId]),
    );

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {recipeIds.length === 0 ? 'No tags defined' : null}
            {recipeIds.map((id) => (
                <RecipeBlock
                    url={url}
                    actorId={actorId}
                    recipe={recipes[id]}
                    tags={tags}
                    key={id}
                    onClick={() => onSelect(id)}
                />
            ))}
        </div>
    );
};

const CreateSettings = ({ settingsCol, tags, recipes, url, client, actorId }) => {
    const [settings, setSettings] = React.useState({
        dinnerTags: null,
        lunchTags: null,
        breakfastTags: null,
        snackTags: null,
        dessertTags: null,
    });

    const [selectedTags, setSelectedTags] = React.useState({});

    const namesToFill = Object.keys(settings).filter((t) => settings[t] === null);

    if (namesToFill.length === 0) {
        return (
            <div>
                All set!
                <Button
                    onClick={() => {
                        settingsCol.save('default', {
                            id: 'default',
                            dinnerTags: settings.dinnerTags || {},
                            lunchTags: settings.lunchTags || {},
                            snackTags: settings.snackTags || {},
                            dessertTags: settings.dessertTags || {},
                            breakfastTags: settings.breakfastTags || {},
                        });
                    }}
                >
                    Save settings
                </Button>
            </div>
        );
    }

    const next = namesToFill[0];
    const name = next.slice(0, -'Tags'.length);

    // TODO test this before deleting the other code
    if (true) {
        return (
            <TagsChooser
                key={name}
                tags={tags}
                recipes={recipes}
                actorId={actorId}
                name={name}
                initial={{}}
                onChoose={async (newTags) => {
                    setSettings({
                        ...settings,
                        // $FlowFixMe
                        [next]: newTags,
                    });
                }}
            />
        );
    }

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
                    setSettings({
                        ...settings,
                        // $FlowFixMe
                        [next]: data,
                    });
                    setSelectedTags({});
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

const EditMealPlan = ({
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
    // TODO maybe allow you to filter out "recently used meals"? That sounds cool.
    const [mealPlansCol, mealPlans] = useCollection<MealPlan, _>(
        React,
        privateClient,
        'weeklyPlans',
    );
    const history = useHistory();
    const [_, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [__, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [___, ingredients] = useCollection<IngredientT, _>(React, client, 'recipes');
    const [____, pantryIngredients] = useCollection<PantryIngredient, _>(
        React,
        privateClient,
        'pantryIngredients',
    );

    const [settingsCol, settings] = useItem<Settings, _>(
        React,
        privateClient,
        'settings',
        'default',
    );

    const { id } = useParams();

    const [belowState, setBelowState] = React.useState(null);

    const [sidebar, setSidebar] = React.useState(null);

    const recipeIds = React.useMemo(() => {
        if (settings) {
            return generateRecipes('dinner', settings, recipes, tags, {}, [], actorId);
        }
        return [];
    }, [settings]);

    if (!mealPlans[id]) {
        return null;
    }
    const plan = mealPlans[id];

    if (!settings) {
        return (
            <div>
                <h1>Lets get you set up.</h1>
                <CreateSettings
                    settingsCol={settingsCol}
                    tags={tags}
                    recipes={recipes}
                    url={url}
                    client={client}
                    actorId={actorId}
                />
            </div>
        );
    }

    return (
        <div>
            <div>For the week starting {id}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {recipeIds.map((id) => (
                    <RecipeBlock
                        url={url}
                        actorId={actorId}
                        recipe={recipes[id]}
                        tags={tags}
                        key={id}
                        onClick={() => setSidebar(id)}
                    />
                ))}
            </div>
            {/* 
            {belowState === null ? (
                <TagSelector
                    url={url}
                    actorId={actorId}
                    tags={tags}
                    recipes={recipes}
                    onSelect={(tid) => setBelowState(tid)}
                />
            ) : (
                <RecipeSelector
                    tid={belowState}
                    url={url}
                    actorId={actorId}
                    tags={tags}
                    recipes={recipes}
                    onSelect={(tid) => setBelowState(tid)}
                />
            )} */}

            {sidebar != null ? (
                <Sidebar
                    onClose={() => setSidebar(null)}
                    id={sidebar}
                    client={client}
                    actorId={actorId}
                    url={url}
                />
            ) : null}
            <DeleteButton
                onConfirm={() => {
                    mealPlansCol.delete(id);
                    history.push('/plans');
                }}
            />
        </div>
    );
};

export default EditMealPlan;
