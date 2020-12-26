// @flow

/**
 * A script for parsing recipes from forsythrecipes
 * into the format expected by foood
 */

/*::

import type {RecipeT} from '../collections'
 */

const fs = require('fs');
const cheerio = require('cheerio');

// const ingredientNames = require('../.import/themealdb.com/in.json').map((m) => m[0]);
const { detectLists, parse, rawToDeltas } = require('../src/parse');

const getAllRecipes = () => {
    const $ = cheerio.load(fs.readFileSync('../.import/Forsyth Recipes.htm'));

    const recipes = {};
    // const byName = {};
    const tags = {};

    let matches = 0;

    const genId = () => Math.random().toString(36).slice(2);

    const parseDate = (text) => {
        if (!text) {
            return Date.now();
        }
        const match = text.match(/^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})\d+$/);
        if (!match) {
            console.log('Not a date?', text);
            return Date.now();
        }
        return new Date(+match.groups.year, +match.groups.month - 1, +match.groups.day).getTime();
    };

    // STOPSHIP NEXT STEP:
    // Determine which of these are really "tags", e.g. they have mostly references to other recipes.
    $('div[title]').each((_, item) => {
        var node = $(item);
        if (!node.attr('created') || node.attr('tags') === 'systenConfig') {
            return;
        }
        const title = node.attr('title');
        const body = node.text().trim();
        const refs = [...body.matchAll(/\[\[(?<title>[^\]]+)\]\]/g)].map((ref) => ref.groups.title);
        const lines = body.split('\n').length;
        if (refs.length > lines * 0.75) {
            // at least 3 quarters of lines are references
            // console.log(title);
            // console.log(refs);
            tags[title] = { recipes: refs, created: parseDate(node.attr('created')) };
            return;
        }
        const recipe /*:RecipeT*/ = {
            id: '',
            about: {
                title: title,
                author: node.attr('creator') ? ':' + node.attri('creator') : '',
                image: '',
                source: 'forsythrecipes',
            },
            statuses: {},
            // modifier: node.attr('modifier'),
            createdDate: parseDate(node.attr('created')),
            updatedDate: parseDate(node.attr('modified')),
            comments: {},
            tags: {},
            contents: {
                changeLog: [],
                version: genId(),
                meta: {
                    ovenTemp: null,
                    cookTime: null,
                    prepTime: null,
                    totalTime: null,
                    yield: null,
                },
                text: rawToDeltas(body),
            },
        };
        if (recipe.updatedDate == null) {
            recipe.updatedDate = recipe.createdDate;
        }
        // recipes.push(recipe);
        recipes[recipe.about.title] = recipe;
        // const haystack = recipe.body.toLowerCase();
        // ingredientNames.forEach((name) => {
        //     if (haystack.includes(name.toLowerCase())) {
        //         matches += 1;
        //     }
        // });
    });

    return { recipes, tags };

    // console.log(matches, recipes.length);
    // // console.log(recipes[200].body);
    // const recipe = byName['Sweet Rice'];
    // const body = recipe.body;
    // console.log(body);
    // console.log(rawToDeltas(body));
    // console.log(recipe.created, recipe.modified);
};

module.exports = getAllRecipes;
// const { recipes, tags } = getAllRecipes();
// console.log(Object.keys(recipes).length, Object.keys(tags).length);
