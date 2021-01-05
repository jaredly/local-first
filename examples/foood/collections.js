// @flow

/**

Schemas:

*/

const TechniquesSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        title: 'string',
        description: 'object',
    },
};

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
        authorId: 'string',
    },
};

const CommentSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        authorId: 'string',
        text: 'object', // this'll be a quill delta, but we don't need real-time or intelligent merging here
        date: 'int',
        happiness: 'int',
        images: 'id-array',
        // TODO more metadata about the experience? idk
    },
};

export const ingredientKinds = [
    'vegetable',
    'leafy green',
    'nut',
    'fruit',
    'spice',
    'grain',
    'carb',
    'dairy',
    'meat',
    'protein',
    'frozen',
    'legume',
];

const IngredientSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        name: 'string',
        alternateNames: { type: 'map', value: 'int' },
        kinds: { type: 'map', value: 'int' },
        densities: { type: 'map', value: 'float' },
        defaultUnit: 'string',
        authorId: 'string',
        // If this ingredient was merged into another one, here's the forwarding address
        mergedInto: { type: 'optional', value: 'string' },
    },
};

/*::

export type TagT = {
    id: string,
    text: string,
    color: ?string,
    created: number,
    authorId: string,
}

export type TechniqueT = {
    id: string,
    title: string,
    description: Array<QuillDelta>,
}

export type SettingsT = {
    id: string,
    categories: Array<string>,
}

export type IngredientT = {
    id: string,
    name: string,
    alternateNames: {[name: string]: number},
    kinds: {[kind: string]: number}, // like "nut" or "flour" probably. Do I normalize these? maybe not just now.
    densities: {[variant: string]: number},
    defaultUnit: string,
    authorId: string,
    mergedInto?: ?string,
}

export type CommentT = {
    id: string,
    authorId: string,
    text: {ops: Array<QuillDelta>},
    date: number,
    happiness: number,
    images: Array<string>,
    recipeVersion: string,
}

export type RecipeStatus = 'favorite' | 'to try' | 'approved' | 'rejected';

export type RecipeAbout = {
    title: string,
    author: string,
    source: string,
    image: string,
}

export type RecipeT = {
    id: string,
    about: RecipeAbout,
    contents: RecipeContents,
    statuses: {
        [userId: string]: RecipeStatus,
    },
    createdDate: number,
    updatedDate: number,
    trashedDate?: ?number,
    comments: {[id: string]: CommentT},
    tags: {[id: string]: number},
    variations?: ?{[key: string]: number},
    variationOf?: ?string,
}

import { type QuillDelta } from '../../packages/rich-text-crdt/quill-deltas';

export type RecipeText = {ops: Array<QuillDelta>}

export type RecipeMeta = {
    ovenTemp: ?string,
    cookTime: ?string,
    prepTime: ?string,
    totalTime: ?string,
    yield: ?string,
}

export type RecipeContents = {
    meta: RecipeMeta,

    text: RecipeText,

    version: string,
    changeLog: Array<{
        fromVersion: string,
        changes: mixed, // hm what I want is to be able to reconstruct the previous version from this
        // but for now I might not. Or I'll just keep the whole thing around? and I can go make it more compact later...
        // lol I mean with it all being a QuillDelta, I can do a diff, right? should be able to.
        changeNote: string,
        date: number,
    }>
}

*/

const RecipeSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        about: {
            type: 'object',
            attributes: {
                title: 'string',
                author: 'string',
                source: 'string',
                image: 'string',
            },
        },
        // This is `RecipeContents`
        // but opaque, because we do internal manual versioning.
        contents: 'object',
        statuses: { type: 'map', value: 'string' }, // 'evaluating' | 'approved' | 'rejected'
        createdDate: 'int',
        updatedDate: 'int',
        trashedDate: { type: 'optional', value: 'int' },
        comments: {
            type: 'map',
            value: CommentSchema,
        },
        tags: { type: 'optional', value: { type: 'map', value: 'int' } },
        variations: { type: 'optional', value: { type: 'map', value: 'number' } },
        variationOf: { type: 'optional', value: 'string' }, // id of another recipe
    },
};

export const schemas = {
    recipes: RecipeSchema,
    ingredients: IngredientSchema,
    tags: TagSchema,
    settings: SettingsSchema,
};

// module.exports = schemas;
