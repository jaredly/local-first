// @flow

const fs = require('fs');
const cheerio = require('cheerio');

const $ = cheerio.load(fs.readFileSync('./.import/Forsyth Recipes.htm'));

const recipes = [];
const byName = {};

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
});
// console.log(recipes[200].body);
console.log(byName['Sweet Rice'].body);
