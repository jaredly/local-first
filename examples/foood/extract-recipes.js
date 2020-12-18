// @flow

/**
 * A script for parsing recipes from forsythrecipes
 * into the format expected by foood
 */

const fs = require('fs');
const cheerio = require('cheerio');

const ingredientNames = require('./.import/themealdb.com/in.json').map((m) => m[0]);

const $ = cheerio.load(fs.readFileSync('./.import/Forsyth Recipes.htm'));

const recipes = [];
const byName = {};

let matches = 0;

$('div[title]').each((_, item) => {
    var node = $(item);
    const recipe = {
        title: node.attr('title'),
        creator: node.attr('creator'),
        modifier: node.attr('modifier'),
        created: node.attr('created'),
        changecount: node.attr('changecount'),
        modified: node.attr('modifiedcreato'),
        body: node.text(),
    };
    recipes.push(recipe);
    byName[recipe.title] = recipe;
    const haystack = recipe.body.toLowerCase();
    ingredientNames.forEach((name) => {
        if (haystack.includes(name.toLowerCase())) {
            matches += 1;
        }
    });
});
console.log(matches, recipes.length);
// console.log(recipes[200].body);
console.log(byName['Sweet Rice'].body);
