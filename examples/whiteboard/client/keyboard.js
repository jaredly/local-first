// @flow

import { type CardT } from './types';

import { type Collection, type Client } from '../../../packages/client-bundle';

export const keyboardTags = (
    key: string,
    keys: Array<string>,
    cardMap: { [key: string]: CardT },
    col: Collection<CardT>,
) => {
    const digits = '0123456789';
    if (digits.includes(key)) {
        const number = +key;
        const cards = keys.map(key => cardMap[key]);
        let remove = !cards.some(card => card.number !== number);
        cards.forEach(card => {
            if (remove) {
                col.setAttribute(card.id, ['number'], null);
            } else if (card.number !== number) {
                col.setAttribute(card.id, ['number'], number);
            }
        });
    }
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    if (letters.includes(key)) {
        const letter = key;
        const cards = keys.map(key => cardMap[key]);
        let remove = !cards.some(card => card.letter !== letter);
        cards.forEach(card => {
            if (remove) {
                col.setAttribute(card.id, ['letter'], null);
            } else if (card.letter !== letter) {
                col.setAttribute(card.id, ['letter'], letter);
            }
        });
    }
};
