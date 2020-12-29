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
import Edit from '@material-ui/icons/Edit';

import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import Tooltip from './Tooltip';

const filter = createFilterOptions();

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const ingredientMatch = (ingredient: IngredientT, needle: string) => {
    return (
        ingredient.name.toLowerCase().includes(needle) ||
        Object.keys(ingredient.alternateNames).some((name) => name.toLowerCase().includes(needle))
    );
};

const Ingredients = ({ client, actorId }: { client: Client<*>, actorId: string }) => {
    const [ingredientsCol, ingredients] = useCollection(React, client, 'ingredients');

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
                <Ingredient ingredient={ingredients[key]} col={ingredientsCol} />
                // <div key={key}>
                //     {ingredients[key].name}
                //     {JSON.stringify(ingredients[key].alternateNames)}
                // </div>
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

const Ingredient = ({ ingredient, col }) => {
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
            {/* <LineEdit
                label="Add alternate name"
                value={'Add alternate name'}
                onChange={(newName) => {
                    col.setAttribute(ingredient.id, ['alternateNames', newName], Date.now());
                }}
            /> */}
        </div>
    );
};

export default Ingredients;
