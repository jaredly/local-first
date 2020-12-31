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
    availability: 'pantry' | 'perishable',
};

export const IngredientClassification = {
    type: 'map',
    value: 'string',
};
