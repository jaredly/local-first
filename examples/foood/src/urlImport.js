// @flow

const MAX_TRAVERSAL_DEPTH = 64;
const MAX_TRAVERSAL_VALUES = 10000;

export class UrlImportError extends Error {
    code: string;

    constructor(code: string) {
        super(code);
        this.name = 'UrlImportError';
        this.code = code;
    }
}

const errorCodeForResponse = (status: number, data: mixed): string => {
    if (
        data != null &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        typeof data.error === 'string'
    ) {
        return data.error;
    }
    if (status === 401) {
        return 'authentication_required';
    }
    if (status === 429) {
        return 'rate_limited';
    }
    return 'upstream_error';
};

export const findAllOfType = (
    roots: Array<mixed>,
    type: string,
    maxDepth: number = MAX_TRAVERSAL_DEPTH,
    maxValues: number = MAX_TRAVERSAL_VALUES,
): Array<any> => {
    const found = [];
    const seen = new Set();
    const seenIds = new Set();
    let visited = 0;

    const visit = (value, depth) => {
        visited += 1;
        if (visited > maxValues || depth > maxDepth) {
            throw new UrlImportError('invalid_response');
        }
        if (value == null || typeof value !== 'object' || seen.has(value)) {
            return;
        }
        seen.add(value);

        if (Array.isArray(value)) {
            value.forEach(item => visit(item, depth + 1));
            return;
        }

        const rawType = value['@type'];
        const types = Array.isArray(rawType) ? rawType : [rawType];
        if (types.includes(type)) {
            const id = typeof value['@id'] === 'string' && value['@id'] !== '' ? value['@id'] : null;
            if (id == null || !seenIds.has(id)) {
                found.push(value);
                if (id != null) {
                    seenIds.add(id);
                }
            }
        }

        Object.keys(value).forEach(key => visit(value[key], depth + 1));
    };

    roots.forEach(root => visit(root, 0));
    return found;
};

const parseResponseJson = async response => {
    try {
        return await response.json();
    } catch (_) {
        throw new UrlImportError('invalid_response');
    }
};

const importRecipes = async (
    sourceUrl: string,
    serverUrl: string,
    token: string,
    signal?: ?AbortSignal,
): Promise<Array<any>> => {
    let response;
    try {
        response = await fetch(
            `${serverUrl}/api/json-ld?url=${encodeURIComponent(sourceUrl)}`,
            {
                headers: {
                    Authorization: `Bearer: ${token}`,
                },
                signal,
            },
        );
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw error;
        }
        throw new UrlImportError('upstream_error');
    }

    let data;
    try {
        data = await parseResponseJson(response);
    } catch (error) {
        if (!response.ok) {
            throw new UrlImportError(errorCodeForResponse(response.status, null));
        }
        throw error;
    }
    if (!response.ok) {
        throw new UrlImportError(errorCodeForResponse(response.status, data));
    }
    if (
        data == null ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        !Array.isArray(data.jsonLd)
    ) {
        throw new UrlImportError('invalid_response');
    }

    return findAllOfType(data.jsonLd, 'Recipe');
};

export const importErrorMessage = (error: mixed): string => {
    const code = error instanceof UrlImportError ? error.code : 'import_failed';
    const messages = {
        authentication_required: 'Your login has expired. Sign in again before importing.',
        origin_not_allowed: 'Recipe import is not available from this site.',
        rate_limited: 'Too many recipe imports. Wait a few minutes and try again.',
        upstream_timeout: 'The recipe page took too long to respond.',
        recipe_page_too_large: 'The recipe page is too large to import.',
        unsupported_content_type: 'That URL did not return an HTML page.',
        upstream_error: 'The recipe page could not be downloaded.',
        json_ld_not_found: 'The page does not contain JSON-LD metadata.',
        invalid_json_ld: 'The page contains JSON-LD that could not be read.',
        invalid_url: 'Enter a valid public recipe URL.',
        invalid_response: 'The recipe import service returned an unexpected response.',
        no_recipes: "No recipes were found in the page's JSON-LD.",
        import_unavailable: 'URL import is unavailable without a server connection.',
        import_failed: 'The recipe could not be imported.',
    };
    return messages[code] || messages.import_failed;
};

const imageUrl = imageObj =>
    typeof imageObj === 'string'
        ? imageObj
        : Array.isArray(imageObj)
        ? imageUrl(imageObj[0])
        : imageObj != null
        ? imageObj.contentUrl || imageObj.url
        : null;

export const findImage = data => {
    const recipe = findAllOfType([data], 'Recipe')[0];
    if (recipe) {
        const image = imageUrl(recipe.image);
        if (image) {
            return image;
        }
    }

    const imageObj = findAllOfType([data], 'ImageObject')[0];
    const image = imageUrl(imageObj);
    if (image) {
        return image;
    }
    const webPage = findAllOfType([data], 'WebPage')[0];
    if (webPage) {
        const primary = imageUrl(webPage.primaryImageOfPage);
        if (primary) {
            return primary;
        }
        const webPageImage = imageUrl(webPage.image);
        if (webPageImage) {
            return webPageImage;
        }
    }
    const article = findAllOfType([data], 'Article')[0];
    if (article) {
        const articleImage = imageUrl(article.image);
        if (articleImage) {
            return articleImage;
        }
        if (Array.isArray(article.images)) {
            return imageUrl(article.images[0]);
        }
    }
};

export default importRecipes;
