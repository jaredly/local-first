// @flow

const proxy = 'https://get-page.jaredly.workers.dev/';
const processRecipe = async (url /*:string*/) => {
    const res = await fetch(`${proxy}?url=${encodeURIComponent(url)}`);
    const text = await res.text();
    const node = document.createElement('div');
    node.innerHTML = text;
    let recipeData = null;
    const jsons = [...node.querySelectorAll('script[type="application/ld+json"]')];
    for (let json of jsons) {
        const data = JSON.parse(json.textContent);
        const recipe = findRecipe(data);
        if (recipe) {
            return recipe;
        }
        console.log('Nope sorry');
        console.log(data);
    }
};

const findRecipe = (data) => {
    if (data['@type'] === 'Recipe') {
        return data;
    }

    if (Array.isArray(data)) {
        for (const sub of data) {
            const res = findRecipe(sub);
            if (res) {
                return res;
            }
        }
    }

    if (data['@type'] == null && data['@graph'] != null) {
        for (let sub of data['@graph']) {
            const res = findRecipe(sub);
            if (res) {
                return res;
            }
        }
    }
};

module.exports = processRecipe;

/*

Examples of ld+json

- https://pinchofyum.com/cinnamon-sugar-apple-cake (need to traverse a little to find the recipe)
- https://www.tasteofhome.com/recipes/winning-apricot-bars/ - has the recipe right there
- https://www.washingtonpost.com/recipes/spiced-cranberry-orange-zingers/12489/ (has two ld+jsons on the page, need to get the @Recipe one)


*/
