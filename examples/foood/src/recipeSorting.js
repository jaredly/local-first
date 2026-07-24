// @flow
import type { RecipeT } from '../collections';

export const statusOrder = ['favorite', 'approved', 'to try', undefined, null, 'rejected'];

export const sortRecipes = (recipeA: RecipeT, recipeB: RecipeT, actorId: string): number => {
    const statusA = statusOrder.indexOf(recipeA.statuses[actorId]);
    const statusB = statusOrder.indexOf(recipeB.statuses[actorId]);
    if (statusA === statusB) {
        return recipeB.updatedDate - recipeA.updatedDate;
    }
    return statusA - statusB;
};
