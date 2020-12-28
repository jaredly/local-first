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

const imageUrl = (imageObj) =>
    typeof imageObj === 'string'
        ? imageObj
        : Array.isArray(imageObj)
        ? imageUrl(imageObj[0])
        : imageObj != null
        ? imageObj.contentUrl || imageObj.url
        : null;

const findImage = (data) => {
    const recipe = findOfType(data, 'Recipe');
    if (recipe) {
        const image = imageUrl(recipe.image);
        if (image) {
            return image;
        }
    }

    const imageObj = findOfType(data, 'ImageObject');
    const image = imageUrl(imageObj);
    if (image) {
        return image;
    }
    if (imageObj) {
        console.log('Bad imageObject', imageObj);
    }
    const webPage = findOfType(data, 'WebPage');
    if (webPage) {
        const primary = imageUrl(webPage.primaryImageOfPage);
        if (primary) {
            return primary;
        }
        const image = imageUrl(webPage.image);
        if (image) {
            return image;
        }
        console.log('## WEBPAGE, but no goodness', webPage);
    }
    const article = findOfType(data, 'Article');
    if (article) {
        const image = imageUrl(article.image);
        if (image) {
            return image;
        }
        if (Array.isArray(article.images)) {
            return imageUrl(article.images[0]);
        }
        console.log('ARTCIEL, but not image', article);
    }
    // console.log('No good?', data)
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
