// @flow

// Classifications
// hm
// "green"
//

import type { Schema } from '../../packages/client-bundle';

export type PrivateTag = {
    id: string,
    name: string,
    recipes: { [key: string]: number },
};

const PrivateTagSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        name: 'string',
        recipes: { type: 'map', value: 'number' },
    },
};

export type PrivateIngredientTag = {
    id: string,
    name: string,
    ingredients: { [key: string]: number },
};

const PrivateIngredientTagSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        name: 'string',
        ingredients: { type: 'map', value: 'number' },
    },
};

// Pantry stuff

export type IngredientAvailability = 'always' | 'sometimes' | 'rarely';
export const ingredientAvailabilities = ['always', 'sometimes', 'rarely'];

export type PantryIngredient = {
    id: string,
    availability: ?IngredientAvailability,
    // TODO: allow people to actually record how much of a thing they have?
};

const PantryIngredientSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        availability: {
            type: 'optional',
            value: 'string',
        },
    },
};

// a weeklyplan's ID is the m/d/y of the day the week starts.
export type WeeklyPlan = {
    meals: {
        // key is "dayofweek-mealtime"
        // where mealtime is breakfast, lunch, dinner, dessert, or snack
        [key: string]: {
            completed: ?number,
            recipes: { [key: string]: number }, // number is the planned batches
            notes: string,
        },
    },
};

const WeeklyPlanSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        meals: {
            type: 'map',
            value: {
                type: 'object',
                attributes: {
                    notes: 'string',
                    recipes: { type: 'map', value: 'number' },
                    completed: { type: 'optional', value: 'number' },
                },
            },
        },
    },
};

export type Homepage = {
    id: string,
    categories: Array<string>,
    recipeQueue: {
        [recipeId: string]: {
            note: string,
            added: number,
        },
    },
};

const HomepageSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        // This is a list of ids of tags that are to be treated as "categories".
        // e.g. they are shown as the home page (with a listing of "latest recipes" below it probably)
        categories: 'id-array',
        // key is the recipeId
        // TODO maybe allow you to write a note about what you want to do?
        recipeQueue: {
            type: 'map',
            value: {
                type: 'object',
                attributes: {
                    note: 'string',
                    added: 'number',
                },
            },
        },
    },
};

export const schemas = {
    homepage: HomepageSchema,
    pantryIngredients: PantryIngredientSchema,
    weeklyPlans: WeeklyPlanSchema,
    privateTag: PrivateTagSchema,
    privateIngredientTag: PrivateIngredientTagSchema,
};
