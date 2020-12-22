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

export type TagT = {
    id: string,
    text: string,
    color: ?string,
    created: number,
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
    alternateNames: Array<string>,
    kinds: Array<string>, // like "nut" or "flour" probably. Do I normalize these? maybe not just now.
}

export type CommentT = {
    id: string,
    author: string,
    text: QuillDelta,
    date: number,
    happiness: number,
    images: Array<string>,
    recipeVersion: string,
}

export type RecipeT = {
    id: string,
    title: string,
    author: string,
    source: string,
    image: string,
    contents: RecipeContents,
    status: 'imported' | 'untried' | 'approved' | 'rejected',
    createdDate: number,
    updatedDate: number,
    trashedDate?: ?number,
    comments: {[id: string]: CommentT},
    tags: {[id: string]: number},
}

import { type QuillDelta } from '../../packages/rich-text-crdt/quill-deltas';

export type RecipeContents = {
    ovenTemp: ?string,
    cookTime: ?string,
    prepTime: ?string,
    totalTime: ?string,
    yield: ?string,

    // ok actually, it will all be one big "contents"
    // maybe? or maybe there are two modes.
    // one where everything's freeform
    // hm. ingredients means you can check them off
    // same with instructions. There's definite value in that.

    // ohhhk, what about: use quill "block-level blots" to indicate "this is an ingredient line"
    // and "this is an instruction line"?
    // that way you can intersperse stuff.
    // Does this have downsides?
    // Should there be a way to explicitly indicate that different ingredients go with different instructions?
    // or that some ingredients are optional? (I mean just having '(optional)' at the end works for me)

    // Yeah, so in terms of customizing quill, having a custom blot for indicating ingredients and instructions
    // sounds awesome. And maybe that's the extent of what I need to modify.

    // So some things will be hyperlinks.
    // So 1 cup macadamia nuts, chopped
    // 1 cup will be a link, to `foood://amount/cups/1`
    // and macadamia nuts will point to `foood://ingredient/143242`
    // ingredients: Array<QuillDelta>,
    // instructions: Array<QuillDelta>,
    // notes: ?string,

    text: Array<QuillDelta>,

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
        title: 'string',
        author: 'string',
        source: 'string',
        image: 'string',
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
        tags: { type: 'optional', value: { type: 'map', value: 'int' } },
    },
};

const schemas = {
    recipes: RecipeSchema,
    ingredients: IngredientSchema,
    tags: TagSchema,
    settings: SettingsSchema,
};

module.exports = schemas;
