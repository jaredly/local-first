// @flow
const toMap = (items) => {
    const res = {};
    if (!items) {
        return res
    }
    const now = Date.now();
    items.forEach((key) => (res[key] = now));
    return res;
};
/*::
import type {RecipeT} from '../collections'
*/

module.exports = async (client/*: * */, actorId/*: string*/, sync/*: () => Promise<mixed>*/) => {
    // ingredients -> get imported as is
    const ingredients = require('./ingredients.json');
    const ingredientsById = {}
    ingredients.forEach(i => ingredientsById[i.id] = i)

    const ingredientCol = client.getCollection('ingredients');

    console.log('ok tags')

    let i = 0
    for (const ingredient of ingredients) {
        if (i++ % 20 === 0 ) {
            await sync()
        }
        await ingredientCol.save(ingredient.id, {
            id: ingredient.id,
            name: ingredient.name,
            alternateNames: toMap(ingredient.alternateNames),
            kinds: {},
            // TODO auto-import densities
            densities: {},
            defaultUnit: ingredient.defaultUnit || '',
            authorId: ':foood-import',
        });
    }

    await sync()

    console.log('ok lists')

    const lists = require('./lists');
    const tagsCol = client.getCollection('tags');
    for (const list of lists) {
        if (i++ % 20 === 0 ) {
            await sync()
        }
        await tagsCol.save(list.id, {
            id: list.id,
            text: list.title,
            created: Date.now(),
            authorId: ':foood-import',
            color: null,
        });
    }

    await sync()

    console.log('ok recipes')

    const madeIts = require('./madeIts');

    const recipes = require('./recipes');
    const recipesCol = client.getCollection/*:: <RecipeT, _>*/('recipes');
    for (const recipe of recipes) {
        if (i++ % 20 === 0 ) {
            await sync()
        }
        const tags = {};
        lists.forEach((list) => {
            if (list.recipes[recipe.id]) {
                tags[list.id] = Date.now();
            }
        });
        let haveMadeIt = false;
        let image = '';

        const comments = {}

        await recipesCol.save(recipe.id, {
            id: recipe.id,
            about: {
                title: recipe.title,
                author: recipe.authorId,
                source: recipe.source || '',
                image,
            },
            contents: {
                meta: {
                    ovenTemp: recipe.meta.ovenTemp,
                    cookTime: recipe.meta.cookTime,
                    prepTime: recipe.meta.prepTime,
                    totalTime: recipe.meta.totalTime,
                    yield: recipe.meta.yield
                        ? recipe.meta.yield +
                          (recipe.meta.yieldUnit ? ' ' + recipe.meta.yieldUnit : '')
                        : null,
                },
                text: { ops: createDeltas(recipe, ingredientsById) },
                changeLog: [],
                version: recipe.id,
            },
            statuses: { [actorId]: 'approved' },
            createdDate: recipe.created,
            updatedDate: recipe.updated,
            trashedDate: null,
            comments,
            tags,
            variations: null,
            variationOf: null,
        });
    }

    await sync()

    // lists -> become tags (v easy)
    // recipes -> need to convert, add links to ingredients
    // madeIts -> add to recipes as comments
};

const Delta = require('quill-delta');

const formatAmount = amount => {
    for (const k of Object.keys(fractions)) {
        if (fractions[k] - 0.0001 < amount && amount < fractions[k] + 0.0001) {
            return k
        }
    }
    if (Math.floor(amount * 100) === amount * 100) {
        return amount.toString()
    }
    return amount.toFixed(2)
}

const fractions = {
    '½': 1/2,
    '⅓': 1/3,
    '⅔': 2/3,
    '¼': 1/4,
    '¾': 3/4,
    '⅕': 1/5,
    '⅖': 2/5,
    '⅗': 3/5,
    '⅘': 4/5,
    '⅙': 1/6,
    '⅚': 5/6,
    '⅐': 1/7,
    '⅛': 1/8,
    '⅜': 3/8,
    '⅝': 5/8,
    '⅞': 7/8,
    '⅑': 1/9,
    '⅒': 1/10,
};

const createDeltas = (recipe, ingredientsById) => {
    // recipe.instructionHeaders, recipe.ingredientHeaders
    // STOPSHIP: handle headers!
    const deltas = [];
    if (recipe.description) {
        deltas.push({ insert: recipe.description });
    }
    if (recipe.ingredients.length) {
        deltas.push({ insert: 'Ingredients' }, { insert: '\n', attributes: { header: 3 } });
        recipe.ingredients.forEach((ingredient) => {
            if (ingredient.amount) {
                deltas.push({
                    insert:
                        formatAmount(ingredient.amount) +
                        (ingredient.unit ? ' ' + ingredient.unit : '') +
                        ' ',
                });
            } else if (ingredient.unit) {
                deltas.push({ insert: ingredient.unit + ' ' });
            }
            if (!ingredientsById[ingredient.ingredient]) {
                console.log('No ingredient: ', ingredient.ingredient, Object.keys(ingredientsById).slice(0, 5), Object.keys(ingredientsById).length)
                deltas.push({
                    insert: 'Unknown ingredient ' + ingredient.ingredient,
                });
            } else {
                deltas.push({
                    insert: ingredientsById[ingredient.ingredient].name,
                    attributes: { ingredientLink: ingredient.ingredient },
                });
            }
            if (ingredient.comments) {
                deltas.push({ insert: ' ' + ingredient.comments });
            }
            deltas.push({ insert: '\n', attributes: { ingredient: true } });
            // TODO
        });
    }
    if (recipe.instructions.length) {
        deltas.push({ insert: 'Instructions' }, { insert: '\n', attributes: { header: 3 } });
        recipe.instructions.forEach((instruction) => {
            deltas.push(
                { insert: instruction.text },
                { insert: '\n', attributes: { instruction: true } },
            );
        });
    }
    if (recipe.notes) {
        deltas.push({ insert: '\n\n' + recipe.notes });
    }
    return deltas;
};
