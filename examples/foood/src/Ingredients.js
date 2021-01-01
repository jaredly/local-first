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
                <div style={{ width: 200 }}>{value}</div>
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
            {/* <LineEdit
                label="Add alternate name"
                value={'Add alternate name'}
                onChange={(newName) => {
                    col.setAttribute(ingredient.id, ['alternateNames', newName], Date.now());
                }}
            /> */}
            <div>
                {ingredientAvailabilities.map((name) => (
                    <IconButton
                        key={name}
                        // variant={
                        //     pantryIngredient != null && pantryIngredient.availability === name
                        //         ? 'contained'
                        //         : 'outlined'
                        // }
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
                            // if (status === name) {
                            //     await col.clearAttribute(recipe.id, ['statuses', actorId]);
                            // } else {
                            //     await col.setAttribute(recipe.id, ['statuses', actorId], name);
                            // }
                        }}
                        style={{ marginRight: 8 }}
                    >
                        {name === 'always' ? (
                            <Check
                                color={
                                    pantryIngredient != null &&
                                    pantryIngredient.availability === name
                                        ? 'secondary'
                                        : 'disabled'
                                }
                            />
                        ) : name === 'sometimes' ? (
                            <Help
                                color={
                                    pantryIngredient != null &&
                                    pantryIngredient.availability === name
                                        ? 'secondary'
                                        : 'disabled'
                                }
                            />
                        ) : (
                            <ShoppingCart
                                color={
                                    pantryIngredient != null &&
                                    pantryIngredient.availability === name
                                        ? 'secondary'
                                        : 'disabled'
                                }
                            />
                        )}
                        {/* {name} */}
                    </IconButton>
                ))}
            </div>
        </div>
    );
});

const Kinds = ({ kinds }) => {
    return (
        <div>
            <Autocomplete
                style={{ flex: 1 }}
                multiple
                id="tags-standard"
                options={ingredientKinds}
                // getOptionLabel={(option) => option.text}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                renderOption={(option) => option}
                value={Object.keys(ingredient.kinds)}
                freeSolo
                filterOptions={(options, params) => {
                    const filtered = filter(options, params);

                    if (params.inputValue !== '') {
                        filtered.push({
                            inputValue: params.inputValue,
                            text: `Add "${params.inputValue}"`,
                        });
                    }

                    return filtered;
                }}
                getOptionLabel={(option) => {
                    // e.g value selected with enter, right from the input
                    if (typeof option === 'string') {
                        return option;
                    }
                    if (option.inputValue) {
                        return option.inputValue;
                    }
                    return option.text;
                }}
                onChange={(event, newValue) => {
                    const added = newValue[newValue.length - 1];

                    // if (added && (typeof added === 'string' || added.inputValue)) {
                    //     const text = typeof added === 'string' ? added : added.inputValue;
                    //     setEditTags(newValue.slice(0, -1).concat({ text }));
                    //     return;
                    // }
                    // setEditTags(newValue);
                }}
                renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="Tags" placeholder="Tags" />
                )}
            />
            <IconButton
                // edge="start"
                // style={{ marginRight: 16 }}
                color="inherit"
                aria-label="menu"
                onClick={async () => {
                    // for (const tag of editTags) {
                    //     if (tag.id != null) {
                    //         if (tags[tag.id] == null) {
                    //             await col.setAttribute(recipeId, ['tags', tag.id], Date.now());
                    //         }
                    //     } else {
                    //         const text = tag.text;
                    //         const tid = client.getStamp();
                    //         await tagsCol.save(tid, {
                    //             id: tid,
                    //             text,
                    //             color: null,
                    //             created: Date.now(),
                    //             authorId: actorId,
                    //         });
                    //         await col.setAttribute(recipeId, ['tags', tid], Date.now());
                    //     }
                    // }
                    // for (const tid of Object.keys(tags)) {
                    //     if (!editTags.some((t) => t.id === tid)) {
                    //         await col.clearAttribute(recipeId, ['tags', tid]);
                    //     }
                    // }
                    // onClose();
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
                    // onClose();
                }}
            >
                <Close />
            </IconButton>
        </div>
    );
};

export default Ingredients;
