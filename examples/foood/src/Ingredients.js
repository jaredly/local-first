// @flow
import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
// import { type QuillDelta } from '../../../packages/rich-text-crdt/quill-deltas';
import QuillEditor from './Quill';
import { parse, detectLists } from './parse';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type {
    RecipeMeta,
    RecipeAbout,
    RecipeText,
    RecipeStatus,
    TagT,
    IngredientT,
} from '../collections';
import urlImport from './urlImport';
import { makeStyles } from '@material-ui/core/styles';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Client, Collection } from '../../../packages/client-bundle';
import Delta from 'quill-delta';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import Check from '@material-ui/icons/Check';
import Help from '@material-ui/icons/Help';
import ShoppingCart from '@material-ui/icons/ShoppingCart';
import Edit from '@material-ui/icons/Edit';

import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import Tooltip from './Tooltip';
import { ingredientKinds } from '../collections';
import { ingredientAvailabilities, type PantryIngredient } from '../private-collections';

const filter = createFilterOptions();

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const ingredientMatch = (ingredient: IngredientT, needle: string) => {
    return (
        ingredient.name.toLowerCase().includes(needle) ||
        Object.keys(ingredient.alternateNames).some((name) => name.toLowerCase().includes(needle))
    );
};

const Ingredients = ({
    client,
    privateClient,
    actorId,
}: {
    client: Client<*>,
    privateClient: Client<*>,
    actorId: string,
}) => {
    const [ingredientsCol, ingredients] = useCollection<IngredientT, _>(
        React,
        client,
        'ingredients',
    );
    const [pantryIngredientsCol, pantryIngredients] = useCollection<PantryIngredient, _>(
        React,
        privateClient,
        'pantryIngredients',
    );

    const [search, setSearch] = React.useState('');

    const keys = Object.keys(ingredients)
        .filter((id) => ingredients[id].mergedInto == null)
        .sort((a, b) => cmp(ingredients[a].name.toLowerCase(), ingredients[b].name.toLowerCase()));

    const needle = search.toLowerCase();
    const results =
        search.trim() != ''
            ? keys.filter((key) => ingredientMatch(ingredients[key], needle))
            : keys;

    return (
        <div>
            <TextField
                placeholder="Search"
                label="Search"
                value={search}
                onChange={(evt) => setSearch(evt.target.value)}
                fullWidth
            />
            {results.map((key) => (
                <Ingredient
                    key={key}
                    pantryIngredient={pantryIngredients[key]}
                    pantryCol={pantryIngredientsCol}
                    ingredient={ingredients[key]}
                    col={ingredientsCol}
                />
            ))}
        </div>
    );
};

const LineEdit = ({ label, value, onChange }) => {
    const [editing, setEditing] = React.useState(null);

    if (editing == null) {
        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 200, fontSize: 20 }}>{value}</div>
                <IconButton
                    onClick={() => {
                        setEditing(value);
                    }}
                >
                    <Edit />
                </IconButton>
            </div>
        );
    }

    return (
        <div>
            <TextField
                placeholder={label}
                label={label}
                value={editing}
                onChange={(evt) => setEditing(evt.target.value)}
            />
            <IconButton
                onClick={() => {
                    onChange(editing);
                    setEditing(null);
                }}
            >
                <Check />
            </IconButton>
            <IconButton
                onClick={() => {
                    setEditing(null);
                }}
            >
                <Close />
            </IconButton>
        </div>
    );
};

const Ingredient = React.memo(({ ingredient, col, pantryIngredient, pantryCol }) => {
    const [altName, setAltName] = React.useState('');
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <div>
                {ingredientAvailabilities.map((name, i) => {
                    const color =
                        pantryIngredient != null && pantryIngredient.availability === name
                            ? 'secondary'
                            : 'disabled';
                    return (
                        <IconButton
                            key={name}
                            edge={
                                i === 0
                                    ? 'end'
                                    : i === ingredientAvailabilities.length - 1
                                    ? 'start'
                                    : false
                            }
                            onClick={async () => {
                                if (
                                    pantryIngredient != null &&
                                    pantryIngredient.availability === name
                                ) {
                                    await pantryCol.clearAttribute(ingredient.id, ['availability']);
                                } else {
                                    if (pantryIngredient == null) {
                                        await pantryCol.save(ingredient.id, {
                                            id: ingredient.id,
                                            availability: name,
                                        });
                                    } else {
                                        await pantryCol.setAttribute(
                                            ingredient.id,
                                            ['availability'],
                                            name,
                                        );
                                    }
                                }
                            }}
                        >
                            {name === 'always' ? (
                                <Check color={color} />
                            ) : name === 'sometimes' ? (
                                <Help color={color} />
                            ) : (
                                <ShoppingCart color={color} />
                            )}
                            {/* {name} */}
                        </IconButton>
                    );
                })}
            </div>
            <div style={{ width: 16 }} />
            <LineEdit
                label="Ingredient name"
                value={ingredient.name}
                onChange={(newName) => {
                    col.setAttribute(ingredient.id, ['name'], newName);
                }}
            />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {Object.keys(ingredient.alternateNames).map((name) => (
                    <div key={name}>
                        {name}
                        <IconButton
                            onClick={() => {
                                col.clearAttribute(ingredient.id, ['alternateNames', name]);
                            }}
                        >
                            <Close />
                        </IconButton>
                    </div>
                ))}
                <TextField
                    value={altName}
                    onChange={(evt) => setAltName(evt.target.value)}
                    placeholder="Add alternate name"
                />
                {altName.trim() != '' ? (
                    <React.Fragment>
                        <IconButton
                            onClick={() => {
                                col.setAttribute(
                                    ingredient.id,
                                    ['alternateNames', altName],
                                    Date.now(),
                                );
                                setAltName('');
                            }}
                        >
                            <Check />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                setAltName('');
                            }}
                        >
                            <Close />
                        </IconButton>
                    </React.Fragment>
                ) : null}
            </div>
            <Kinds kinds={ingredientKinds} ingredient={ingredient} col={col} />
            {/* <LineEdit
                label="Add alternate name"
                value={'Add alternate name'}
                onChange={(newName) => {
                    col.setAttribute(ingredient.id, ['alternateNames', newName], Date.now());
                }}
            /> */}
        </div>
    );
});

const Kinds = ({ kinds, ingredient, col }) => {
    const [current, setCurrent] = React.useState(null);

    if (!current) {
        return (
            <div>
                {Object.keys(ingredient.kinds).map((kind) => (
                    <span id={kind}>{kind}</span>
                ))}
                {Object.keys(ingredient.kinds).length === 0 ? 'Kinds' : null}
                <IconButton
                    // edge="start"
                    // style={{ marginRight: 16 }}
                    color="inherit"
                    aria-label="menu"
                    onClick={() => {
                        setCurrent(Object.keys(ingredient.kinds));
                    }}
                >
                    <Edit />
                </IconButton>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex' }}>
            <Autocomplete
                // style={{ flex: 1 }}
                multiple
                id="tags-standard"
                options={ingredientKinds}
                // getOptionLabel={(option) => option.text}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                renderOption={(option) => option}
                value={current}
                onChange={(event, newValue) => {
                    setCurrent(newValue);
                }}
                renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="Kinds" placeholder="Kinds" />
                )}
            />
            <IconButton
                // edge="start"
                // style={{ marginRight: 16 }}
                color="inherit"
                aria-label="menu"
                onClick={async () => {
                    for (const kind of Object.keys(ingredient.kinds)) {
                        if (!current.includes(kind)) {
                            await col.clearAttribute(ingredient.id, ['kinds', kind]);
                        }
                    }
                    for (const kind of current) {
                        if (ingredient.kinds[kind] == null) {
                            await col.setAttribute(ingredient.id, ['kinds', kind], Date.now());
                        }
                    }
                    setCurrent(null);
                }}
            >
                <Check />
            </IconButton>
            <IconButton
                // edge="start"
                // style={{ marginRight: 16 }}
                color="inherit"
                aria-label="menu"
                onClick={() => {
                    setCurrent(null);
                }}
            >
                <Close />
            </IconButton>
        </div>
    );
};

export default Ingredients;
