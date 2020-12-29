// @flow

/**
 * A script for parsing recipes from forsythrecipes
 * into the format expected by foood
 */

/*::

import type {RecipeT, IngredientT} from '../collections'
 */

const fs = require('fs');
const cheerio = require('cheerio');

// const ingredientNames = require('../.import/themealdb.com/in.json').map((m) => m[0]);
const { detectLists, parse, rawToDeltas } = require('../src/parse');

const { findImageFromPage } = require('./import-from-foood');

const tenYearsAgo = Date.now() - 1000 * 60 * 60 * 24 * 365 * 10;

const getFirstUrl = (body) => {
    const rx = /(((https?\/\/)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
    const match = body.match(rx);
    if (match) {
        // console.log('Found URL!', match[0]);
        return match[0];
    }
};

const getAllRecipes = async (allIngredients /*: {[key: string]: IngredientT}*/) => {
    const $ = cheerio.load(fs.readFileSync('../.import/Forsyth Recipes.htm'));

    const recipes = {};
    // const byName = {};
    const tags = {};

    let matches = 0;

    const genId = () => Math.random().toString(36).slice(2);

    const parseDate = (text) => {
        if (!text) {
            return tenYearsAgo;
        }
        const match = text.match(/^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})\d+$/);
        if (!match) {
            console.log('Not a date?', text);
            return tenYearsAgo;
        }
        return new Date(+match.groups.year, +match.groups.month - 1, +match.groups.day).getTime();
    };

    const nodes = [];
    $('div[title]').each((_, item) => {
        nodes.push($(item));
    });

    for (const node of nodes) {
        const title = node.attr('title');
        if (
            !node.attr('created') ||
            node.attr('tags') === 'systenConfig' ||
            title === 'UploadLog' ||
            title === 'SiteTitle' ||
            title === 'SiteSubtitle'
        ) {
            continue;
        }
        const body = node.text().trim();
        const refs = [...body.matchAll(/\[\[(?<title>[^\]\|]+)\]\]/g)].map(
            (ref) => ref.groups.title,
        );
        const lines = body.split('\n').length;
        if (refs.length > lines * 0.75) {
            // at least 3 quarters of lines are references
            // console.log(title);
            // console.log(refs);
            tags[title] = { recipes: refs, created: parseDate(node.attr('created')) };
            continue;
        }
        let image = '';
        let source = 'forsythrecipes';

        // STOPSHIP: enable this again once I've got ingredient parsing down
        const potentialSource = getFirstUrl(body);
        if (potentialSource) {
            source = potentialSource;
            // image = await findImageFromPage(potentialSource).catch((err) => '');
            // if (image) {
            //     console.log('😍 😍 😍 😍 Got an image!', title);
            //     source = potentialSource;
            // } else {
            //     console.log('❌ ❌ ❌ No image for url', potentialSource, title);
            // }
        }

        const recipe /*:RecipeT*/ = {
            id: '',
            about: {
                title: title,
                author: node.attr('creator') ? ':' + node.attr('creator') : '',
                image,
                source,
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
                text: rawToDeltas(body, allIngredients),
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
    }

    const emptyTags = [];
    Object.keys(tags).forEach((name) => {
        if (!tags[name].recipes.some((name) => recipes[name] != null)) {
            console.log('Empty tag!', name);
            emptyTags.push(name);
        }
    });
    emptyTags.forEach((name) => {
        delete tags[name];
    });

    return { recipes, tags };
};

module.exports = getAllRecipes;
