// @flow

import type { IngredientT } from '../collections';

export const getIngredient = (ingredients: { [key: string]: IngredientT }, id: string) => {
    let ing = ingredients[id];
    while (ing?.mergedInto != null) {
        ing = ingredients[ing.mergedInto];
    }
    return ing;
};

export const imageUrl = (image: string, serverUrl: string) => {
    if (image.startsWith('foood://')) {
        return serverUrl + '/uploads/' + image.slice('foood://'.length);
    }
    return image;
};
