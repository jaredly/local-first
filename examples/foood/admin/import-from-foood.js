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
import type {RecipeT, IngredientT} from '../collections'
import type { Client, Collection } from '../../../packages/client-bundle';
*/

// $FlowFixMe it's fine
const fetch = require('../../planner/server/node_modules/node-fetch');
const cheerio = require('cheerio')
const {findImage} = require('../src/urlImport')

const findImageFromPage = async (source) => {
    console.log('Fetching', source, 'for image')
    const contents = await (await fetch(source, {
        headers: {
            'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36'
        }
    })).text()
    const $ = cheerio.load(contents)
    const jsons = []
    console.log(contents.length, contents.slice(0, 100))
    $('script').each((_, json) => {
        const node = $(json)
        // console.log(node.attr('type'), node.html())
        if (node.attr('type') === 'application/ld+json') {
            const raw = node.html()
            try {
                jsons.push(JSON.parse(raw))
            } catch (err) {
                const decommented = raw.replace(/^\s+\/\/.+$/mg, '')
                try {
                    jsons.push(JSON.parse(decommented))
                } catch (err) {
                    // unable to parse json probabl
                    console.log('Invalid json in a script tag!')
                }
            }
        }
    })
    for (const data of jsons) {
        const image = findImage(data)
        if (image) {
            return image
        }
    }
    const metas = []
    $('meta[property="og:image"]').each((_, meta) => metas.push($(meta).attr('content')))
    if (metas.length) {
        return metas[0]
    }
    console.log('No good?', jsons.length, jsons.map(m => m['@type']))
    return ''
}

module.exports = async (client/*: Client<*> */, actorId/*: string*/, sync/*: () => Promise<mixed>*/) => {
    // ingredients -> get imported as is
    const ingredients = require('./ingredients.json');
    const ingredientsById = {}
    ingredients.forEach(i => ingredientsById[i.id] = i)

    const ingredientCol = client.getCollection/*::<IngredientT>*/('ingredients');

    console.log('ok tags')

    let i = 0
    for (const ingredient of ingredients) {
        if (i++ % 20 === 0 ) {
            await sync()
        }
        const current = await ingredientCol.load(ingredient.id)
        // Don't override if it exists
        if (!current) {
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

        if (recipe.source) {
            image = await findImageFromPage(recipe.source).catch(err => '')
        }

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
        deltas.push({ insert: recipe.description + '\n\n' });
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

module.exports.findImageFromPage = findImageFromPage