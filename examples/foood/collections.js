// @flow

/**

Schemas:

*/

const SettingsSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        // This is a list of ids of tags that are to be treated as "categories".
        // e.g. they are shown at the top of the home page.
        categories: 'id-array',
    },
};

const TagSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        text: 'string',
        color: { type: 'optional', value: 'string' },
        created: 'int',
    },
};

const CommentSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        author: 'string',
        text: 'object', // this'll be a quill delta, but we don't need real-time or intelligent merging here
        date: 'int',
        happiness: 'int',
        images: 'id-array',
        // TODO more metadata about the experience? idk
    },
};

const IngredientSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        name: 'string',
        alternateNames: 'id-array',
        kinds: 'id-array',
    },
};

/*::

type SettingsT = {
    id: string,
    categories: Array<string>,
}

type IngredientT = {
    id: string,
    name: string,
    alternateNames: Array<string>,
    kinds: Array<string>, // like "nut" or "flour" probably. Do I normalize these? maybe not just now.
}

type CommentT = {
    id: string,
    author: string,
    text: QuillDelta,
    date: number,
    happiness: number,
    images: Array<string>,
    recipeVersion: string,
}

type RecipeT = {
    id: string,
    title: string,
    author: string,
    source: string,
    contents: RecipeContents,
    status: 'evaluation' | 'approved' | 'rejected',
    createdDate: number,
    updatedDate: number,
    trashedDate?: ?number,
    comments: {[id: string]: CommentT}
}

type QuillDelta = Array<{insert: string}>;

type RecipeContents = {
    ovenTemp: ?number,
    bakeTime: ?number,
    yield: ?string,
    // So some things will be hyperlinks.
    // So 1 cup macadamia nuts, chopped
    // 1 cup will be a link, to `foood://amount/cups/1`
    // and macadamia nuts will point to `foood://ingredient/143242`
    ingredients: Array<QuillDelta>,
    instructions: Array<QuillDelta>,
    notes: ?string,

    version: string,
    changeLog: Array<{
        fromVersion: string,
        changes: mixed, // hm what I want is to be able to reconstruct the previous version from this
        // but for now I might not. Or I'll just keep the whole thing around? and I can go make it more compact later...
        changeNote: string,
        date: number,
    }>
}

*/

const RecipeSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        author: 'string',
        source: 'string',
        // This is `RecipeContents`
        // but opaque, because we do internal manual versioning.
        contents: 'object',
        status: 'string', // 'evaluating' | 'approved' | 'rejected'
        createdDate: 'int',
        updatedDate: 'int',
        trashedDate: { type: 'optional', value: 'int' },
        comments: {
            type: 'map',
            value: CommentSchema,
        },
    },
};

const schemas = {
    recipes: RecipeSchema,
    ingredients: IngredientSchema,
    tags: TagSchema,
    settings: SettingsSchema,
};

module.exports = schemas;
