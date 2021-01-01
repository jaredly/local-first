// @flow

// Classifications
// hm
// "green"
//

// a weeklyplan's ID is the m/d/y of the day the week starts.
export type WeeklyPlan = {
    meals: {
        // key is "dayofweek-mealtime"
        // where mealtime is breakfast, lunch, dinner, dessert, or snack
        [key: string]: {
            recipes: { [key: string]: number }, // number is the planned batches
            notes: string,
        },
    },
};

export type IngredientClassificationT = {
    id: string,
    availability: 'always' | 'sometimes' | null,
    // I want to be able to add tags for preferences (e.g. "x person likes/dislikes")
    // What's the best way to do that?
    // Maybe have "PersonalIngredientTags" that you can name however you want
    // and then allow coloring based on those too?
    // In addition to colors based on global ingredient kind infos.
};

type PrivateTag = {
    id: string,
    name: string,
    recipes: { [key: string]: number },
};

type PrivateIngredientTag = {
    id: string,
    name: string,
    ingredients: { [key: string]: number },
};

export const IngredientClassification = {
    type: 'map',
    value: 'string',
};
