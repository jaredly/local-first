// @flow

const proxy = 'https://get-page.jaredly.workers.dev/';

const getJsons = async (url) => {
    const res = await fetch(`${proxy}?url=${encodeURIComponent(url)}`);
    const text = await res.text();
    const node = document.createElement('div');
    node.innerHTML = text;
    let recipeData = null;
    const jsons = [...node.querySelectorAll('script[type="application/ld+json"]')];
    return jsons;
};

const processRecipe = async (url /*:string*/) => {
    const jsons = await getJsons(url);
    let recipeData = null;

    for (let json of jsons) {
        const data = JSON.parse(json.textContent);
        const recipe = findOfType(data, 'Recipe');
        if (recipe) {
            return recipe;
        }
        console.log('Nope sorry');
        console.log(data);
    }
};

const findImage = (data) => {
    const image = findOfType(data, 'ImageObject');
    if (image) {
        return image.contentUrl || image.url;
    }
    const webPage = findOfType(data, 'WebPage');
    if (webPage && webPage.primaryImageOfPage) {
        return webPage.primaryImageOfPage.contentUrl || webPage.primaryImageOfPage.url;
    }
};

const findOfType = (data, type) => {
    if (data['@type'] === type) {
        return data;
    }

    if (Array.isArray(data)) {
        for (const sub of data) {
            const res = findOfType(sub, type);
            if (res) {
                return res;
            }
        }
    }

    if (data['@type'] == null && data['@graph'] != null) {
        for (let sub of data['@graph']) {
            const res = findOfType(sub, type);
            if (res) {
                return res;
            }
        }
    }
};

module.exports = processRecipe;
module.exports.findImage = findImage;

/*

Examples of ld+json

- https://pinchofyum.com/cinnamon-sugar-apple-cake (need to traverse a little to find the recipe)
- https://www.tasteofhome.com/recipes/winning-apricot-bars/ - has the recipe right there
- https://www.washingtonpost.com/recipes/spiced-cranberry-orange-zingers/12489/ (has two ld+jsons on the page, need to get the @Recipe one)


*/
