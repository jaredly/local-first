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

// always = "you have it in your pantry"
// sometimes = "check your pantry"
// rarely = "buy this"
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

export type Settings = {
    id: string,
    dinnerTags: { [key: string]: number },
    lunchTags: { [key: string]: number },
    breakfastTags: { [key: string]: number },
    snackTags: { [key: string]: number },
    dessertTags: { [key: string]: number },
};

const SettingsSchema: Schema = {
    type: 'object',
    attributes: {
        id: 'string',
        dinnerTags: { type: 'map', value: 'number' },
        lunchTags: { type: 'map', value: 'number' },
        breakfastTags: { type: 'map', value: 'number' },
        snackTags: { type: 'map', value: 'number' },
        dessertTags: { type: 'map', value: 'number' },
    },
};

// a weeklyplan's ID is the m/d/y of the day the week starts.
export type MealPlan = {
    id: string,
    ingredientsToUse?: {
        [key: string]: number,
    },
    randomRecipes?: {
        [key: string]: number,
    },
    uncategorizedRecipes: {
        [key: string]: number, // ooh maybe the number is "batches"? yes.
    },
    meals: {
        // key is "dayofweek-mealtime"
        // where mealtime is breakfast, lunch, dinner, dessert, or snack
        // ermmmm what if you want to just add some?
        // I guess I could have a "unordered meals"
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
        ingredientsToUse: { type: 'optional', value: { type: 'map', value: 'number' } },
        randomRecipes: { type: 'optional', value: 'object' }, // opaque; we only want to ever replace them all at once
        uncategorizedRecipes: {
            type: 'map',
            value: 'number',
        },
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
    settings: SettingsSchema,
};
