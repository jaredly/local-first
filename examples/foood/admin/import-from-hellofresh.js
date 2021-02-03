// @flow

import type { Client } from '../../../packages/client-bundle';
import type { RecipeT, IngredientT, TagT } from '../collections';
import fs from 'fs';

const theOtherS = (name) => (name.endsWith('s') ? name.slice(0, -1) : name + 's');

const importIngredients = async (client, sync, weeks, dryRun) => {
    const ingredientsCol = client.getCollection<IngredientT>('ingredients');
    const ingredients = await ingredientsCol.loadAll();
    fs.writeFileSync('./my-ing.json', JSON.stringify(ingredients, null, 2));

    const byName = {};
    Object.keys(ingredients).forEach((k) => {
        const ing = ingredients[k];
        byName[ing.name.toLowerCase()] = ing.id;
        byName[theOtherS(ing.name.toLowerCase())] = ing.id;
        Object.keys(ing.alternateNames).forEach((alt) => {
            byName[alt.toLowerCase()] = ing.id;
        });
    });

    const foundIngredients = {};

    const newIngredients = {};
    weeks.forEach((week) => {
        if (!week.recipes) {
            return;
        }
        week.recipes.forEach((recipe) => {
            recipe.ingredients.forEach((ing) => {
                if (foundIngredients[ing.id] || newIngredients[ing.id]) {
                    return;
                }
                const names = [ing.name.toLowerCase(), ing.slug.replace(/-/g, ' ')];
                let found = null;
                for (const name of names) {
                    if (byName[name] != null) {
                        found = byName[name];
                        break;
                    }
                }
                if (found) {
                    foundIngredients[ing.id] = found;
                } else {
                    newIngredients[ing.id] = ing;
                }
            });
        });
    });
    console.log('New ingredients', Object.keys(newIngredients).length);

    fs.writeFileSync('./fresh-ing.json', JSON.stringify(newIngredients, null, 2));

    if (dryRun) {
        return { ingredients, foundIngredients };
    }

    for (const id of Object.keys(newIngredients)) {
        const ing = newIngredients[id];
        ingredientsCol.save(id, {
            id,
            name: ing.name,
            alternateNames: {
                [ing.slug.replace(/-/g, ' ')]: Date.now(),
            },
            kinds: {},
            densities: {},
            defaultUnit: '',
            authorId: ':hello-fresh-import',
        });
        foundIngredients[id] = id;
    }

    await sync();
    return { ingredients: await ingredientsCol.loadAll(), foundIngredients };
};

const importRecipes = async (client, sync, weeks, ingredients, foundIngredients, dryRun) => {
    const recipesCol = client.getCollection<IngredientT>('recipes');
    const recipes = await recipesCol.loadAll();

    const tagsCol = client.getCollection<TagT>('tags');
    const tags = await tagsCol.loadAll();

    let helloTag = null;
    Object.keys(tags).forEach((t) => {
        if (tags[t].text.toLowerCase() === 'hello fresh') {
            helloTag = t;
        }
    });

    if (!helloTag) {
        helloTag = tagsCol.genId();
        await tagsCol.save(helloTag, {
            id: helloTag,
            text: 'Hello Fresh',
            color: null,
            created: Date.now(),
            authorId: ':hello-fresh',
        });
    }

    const toAdd = {};

    for (const week of weeks) {
        if (!week.recipes) {
            continue;
        }
        for (const recipe of week.recipes) {
            if (!recipe.ingredients || !recipe.ingredients.length) {
                continue;
            }
            if (recipes[recipe.canonical]) {
                continue;
            }
            if (
                toAdd[recipe.canonical] &&
                toAdd[recipe.canonical].updatedDate < new Date(recipe.updatedAt).getTime()
            ) {
                continue;
            }
            toAdd[recipe.canonical] = {
                id: recipe.canonical,
                about: {
                    title: recipe.name,
                    author: ':hello-fresh',
                    source: recipe.websiteUrl,
                    image: `https://img.hellofresh.com/c_fit,f_auto,fl_lossy,h_1100,q_auto,w_2600/hellofresh_s3${recipe.imagePath}`,
                },
                contents: makeContents(recipe, ingredients, foundIngredients),
                statuses: {},
                createdDate: new Date(recipe.createdAt).getTime(),
                updatedDate: new Date(recipe.createdAt).getTime(),
                comments: {},
                tags: { [helloTag]: Date.now() }, // STOPSHIP add the 'hello fresh' tag
            };
        }
    }

    fs.writeFileSync('./hf-import.json', JSON.stringify(toAdd, null, 2));
    console.log('New recipes', Object.keys(toAdd).length);
    if (dryRun) {
        return;
    }

    let x = 0;
    for (const id of Object.keys(toAdd).sort()) {
        if (recipes[id]) {
            continue;
        }
        if (x++ % 20 == 0) {
            await sync();
        }
        // console.log(id);
        await recipesCol.save(id, toAdd[id]);
    }
    await sync();
};

const showTime = (time) => {
    if (!time) {
        return null;
    }
    if (time.hours != 0) {
        return `${time.hours} hours, ${time.minutes} min`;
    }
    return `${time.minutes} min`;
};

const parseTime = (time) => {
    if (!time) {
        return null;
    }
    const [_, sub] = time.split('T');
    if (!sub.includes('H')) {
        return { hours: 0, minutes: +sub.slice(0, -1) };
    }
    const [hours, minutes] = sub.split('H');
    return {
        hours: +hours,
        minutes: +minutes.slice(0, -1),
    };
};

const makeContents = (recipe, ingredients, foundIngredients) => {
    const { deltas, ovenTemp } = makeRecipeDelta(recipe, ingredients, foundIngredients);
    return {
        meta: {
            prepTime: showTime(parseTime(recipe.prepTime)),
            totalTime: showTime(parseTime(recipe.totalTime)),
            cookTime: null,
            yield: '2 servings',
            ovenTemp,
        },
        text: { ops: deltas },
        version: recipe.canonical,
        changeLog: [],
    };
};

import { formatNumber } from '../src/parse';

const makeRecipeDelta = (recipe, ingredients, foundIngredients) => {
    let ovenTemp = null;
    let deltas = [{ insert: recipe.description + '\n\n' }];
    recipe.yields[0].ingredients.forEach((ing) => {
        const id = foundIngredients[ing.id];
        if (ing.amount) {
            deltas.push({
                insert: formatNumber(ing.amount, ing.unit) + ' ',
            });
        } else if (ing.unit != null) {
            deltas.push({ insert: ing.unit + ' ' });
        }
        deltas.push(
            {
                insert: ingredients[id].name,
                attributes: { ingredientLink: id },
            },
            { insert: '\n', attributes: { ingredient: true } },
        );
    });

    deltas.push({ insert: '\n' });

    recipe.steps.forEach((step) => {
        deltas.push(
            { insert: step.instructions.replace(/\s*\n\s*/g, ' ') },
            { insert: '\n', attributes: { instruction: true } },
        );
        const oven = step.instructions.match(/oven.+?\b(\d{3})°?\b/i);
        if (oven) {
            ovenTemp = oven[1];
        }
        // TODO would be cool to go through and highlight the ingredients listed in step.ingredients
    });
    return { deltas, ovenTemp };
};

const runImport = async (client: Client<*>, actorId: string, sync: () => Promise<mixed>) => {
    const weeks = require('./../.import/hellofresh/2019.json');

    const { ingredients, foundIngredients } = await importIngredients(client, sync, weeks, false);

    await importRecipes(client, sync, weeks, ingredients, foundIngredients, true);
};

export default runImport;
