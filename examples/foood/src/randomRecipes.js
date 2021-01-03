// @flow
import type { RecipeT, TagT, IngredientT } from '../collections';
import type { Settings, PantryIngredient } from '../private-collections';

/*

What's our strategy here?
- x% from approved
- x% from 'to try'
- x% from uncategorized

maybe 7 from each? or 10 from each?


*/

export const generateRecipes = (
    meal: string,
    settings: Settings,
    recipes: *,
    tags: *,
    pantryIngredients: *,
    ingredientsToUse: Array<string>,
    actorId: string,
) => {
    const tagsToUse = Object.keys(settings[meal + 'Tags']);
    const recipesToUse = { approved: [], 'to try': [], undefined: [] };
    Object.keys(recipes).forEach((id) => {
        if (!tagsToUse.some((tid) => recipes[id].tags[tid])) {
            return;
        }
        if (recipesToUse[recipes[id].statuses[actorId]] != null) {
            recipesToUse[recipes[id].statuses[actorId]].push(id);
        }
    });
    const picked = [];
    for (let i = 0; i < 10; i++) {
        const at = parseInt(Math.random() * recipesToUse.approved.length);
        picked.push(recipesToUse.approved[at]);
        recipesToUse.approved.splice(at, 1);
    }
    for (let i = 0; i < 10; i++) {
        const at = parseInt(Math.random() * recipesToUse['to try'].length);
        picked.push(recipesToUse['to try'][at]);
        recipesToUse['to try'].splice(at, 1);
    }
    for (let i = 0; i < 5; i++) {
        const at = parseInt(Math.random() * recipesToUse.undefined.length);
        picked.push(recipesToUse.undefined[at]);
        recipesToUse.undefined.splice(at, 1);
    }
    return picked;
};
