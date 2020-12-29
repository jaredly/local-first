// @flow

const fractions = {
    '1/2': '½',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/4': '¼',
    '3/4': '¾',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
    '1/7': '⅐',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞',
    '1/9': '⅑',
    '1/10': '⅒',
};

const allUnicodeFractions = Object.keys(fractions).map((k) => fractions[k]);
const unicodeFraction = allUnicodeFractions.join('|');

const simpleNumber = `\\d+`;
const decimal = `\\d+(\\.\\d+)`;

const manualFraction = `${simpleNumber}\\s*/\\s*${simpleNumber}`;

const fraction = `${manualFraction}|${unicodeFraction}`;

// const mixedNumber = `${fraction}(?:(\\s*(${unicodeFraction})|(\\s+${manualFraction})))?`;
const mixedNumber = (suffix) =>
    `(?<mixed_whole${suffix}>${simpleNumber})(?<mixed_fract${suffix}>(?:\\s*${unicodeFraction})|(?:\\s+${manualFraction}))`;
const totalNumber = (suffix) =>
    `(?<mixed${suffix}>${mixedNumber(
        suffix,
    )})|(?<decimal${suffix}>${decimal})|(?<fract${suffix}>${fraction})|(?<int${suffix}>${simpleNumber})`;

const units = {
    pound: ['[Pp]ounds?', '[Ll]bs?\\.?'],
    quart: ['[Qq]uarts?', '[Qq]ts?\\.?'],
    cup: ['[Cc]ups?', '[Cc]\\.?'],
    teaspoon: ['[Tt]sp\\.?', '[Tt]easpoons?', 't\\.?'],
    tablespoon: ['[Tt]bsp?\\.?', '[Tt]ablespoons?', 'T\\.?'],
    gram: ['[Gg]rams?', 'gr?\\.?'],
    kilogram: ['[Kk]ilo(gram)?s?', '[Kk][Gg]?\\.?'],
    liter: ['[Ll]iters?', '[Ll]itres?', '[Ll]\\.?'],
    milligram: ['[Mm]ill?igrams?', '[Mm]g\\.?'],
};

const unitRx = Object.keys(units)
    .map((k) => `(${units[k].join('|')})`)
    .join('|');

const fullRaw = `(?<number>${totalNumber('')})(\\s*-\\s*(?<range>${totalNumber(
    '_range',
)}))?(?:\\s*(?<unit>${unitRx}))?`;
// console.log(fullRaw);
const rx = new RegExp(fullRaw, 'g');
const rxStart = new RegExp('^\\s*[-*]?\\s*' + fullRaw, 'g');
const informal = new RegExp('^(shy|heaping|dash|pinch)\b', 'i');

const getNumbers = (text) => {
    const results = [];
    text.replace(rx, (...args) => {
        const groups = args.pop();
        const whole = args.pop();
        const offset = args.pop();
        const match = args[0];
        const populated = {};
        if (typeof groups === 'object') {
            Object.keys(groups).forEach((k) => {
                if (groups[k] != null) {
                    populated[k] = groups[k];
                }
            });
        }
        results.push({ offset, groups: populated, match });
        return '';
    });
    return results;
};

// setTimeout(() => {
//     const examples = ['1⅘', '1 1/2', '23/3', '⅘', '5'];
//     examples.forEach((example) => {
//         console.log('>', example);
//         console.log(getNumbers(example));
//     });
// }, 1000);

const parse = (text /*: string*/) => {
    // how do ingredients work?
    // first, we've got "numbers and units"
    // yeah, so we can format them as something special
    // and then we can think about other things
    // console.log('(parsing)', text);
    return getNumbers(text);
};

const detectLinks = (text) => {
    const rx = /\[\[(?<name>[^\]|]+)\|(?<href>[^\]]+)\]\]/g;
    const matches = [...text.matchAll(rx)].reverse();
    return matches.map((match) => [
        match.index,
        match[0].length,
        // $FlowFixMe
        match.groups.name,
        // $FlowFixMe
        { link: match.groups.href },
    ]);
};

const Delta = require('quill-delta');
const rawToDeltas = (text /*:string*/, allIngredients /*:Ingredients*/) => {
    let doc = new Delta().insert(text);
    const { ingredients, instructions } = detectLists(text);
    // console.log(ingredients, instructions);
    ingredients.forEach((pos) => {
        doc = doc.compose(new Delta().retain(pos).retain(1, { ingredient: true }));
    });
    instructions.forEach((pos) => {
        doc = doc.compose(new Delta().retain(pos).retain(1, { instruction: true }));
    });

    // NOTE: it's very important that links are listed in reverse order
    // Because we're modifying the source
    const links = detectLinks(text);
    links.forEach(([index, length, insert, attributes]) => {
        doc = doc.compose(new Delta().retain(index).delete(length).insert(insert, attributes));
    });

    const updates = detectIngredients(doc.ops, allIngredients);
    updates.forEach((update) => {
        doc = doc.compose(update);
    });
    // console.log('updates from ingredients', updates.length, Object.keys(allIngredients).length);

    return doc;
};

/*::
type Ingredients = {[key: string]: {name: string, alternateNames: {[key: string]: number}, mergedInto?: ?string}}
*/

const detectIngredients = (contents /*:Array<Delta>*/, ingredients /*: Ingredients */) => {
    const updates = [];
    let x = 0;
    contents.forEach((delta, i) => {
        const next = contents[i + 1];
        let pos = x;
        x += typeof delta.insert === 'string' ? delta.insert.length : 1;
        if (
            !next ||
            typeof delta.insert !== 'string' ||
            next.insert !== '\n' ||
            !next.attributes ||
            !next.attributes.ingredient
        ) {
            return;
        }
        const lines = delta.insert.split('\n');
        const lastLine = lines[lines.length - 1];
        pos = x - lastLine.length;
        const haystack = lastLine.toLowerCase();
        const matches = [];
        Object.keys(ingredients).forEach((id) => {
            const ing = ingredients[id];
            if (ing.mergedInto != null) {
                return;
            }
            const idx = haystack.indexOf(ing.name.toLowerCase());
            if (idx !== -1) {
                matches.push({ id, ln: ing.name.length, idx });
            }
            Object.keys(ing.alternateNames).forEach((name) => {
                const idx = haystack.indexOf(name.toLowerCase());
                if (idx !== -1) {
                    matches.push({ id, ln: name.length, idx });
                }
            });
        });
        matches.sort((a, b) => b.ln - a.ln);
        if (matches.length) {
            updates.push(
                new Delta()
                    .retain(pos + matches[0].idx)
                    .retain(matches[0].ln, { ingredientLink: matches[0].id }),
            );
        }
    });
    return updates;
};

const detectLists = (text /*:string*/) => {
    const lines = text.split('\n');
    let at = 0;
    let status = null;
    const ingredients = [];
    const instructions = [];
    lines.forEach((line) => {
        // let current = at
        at += line.length + 1;
        if (!line.trim().length) {
            return;
        }
        const short = line.match(/^\s*(\w+)\s*:?\.?\s*$/i);
        if (short) {
            const title = short[1].toLowerCase();
            if (title === 'ingredients') {
                status = 'ingredients';
            }
            if (title === 'instructions' || title === 'directions' || title === 'steps') {
                status = 'instructions';
            }
            if (title === 'notes') {
                status = 'notes';
            }
            // console.log('title', title);
            return;
        }
        if (status === 'ingredients') {
            ingredients.push(at - 1);
        }
        if (status === 'instructions') {
            instructions.push(at - 1);
        }
        if (status === null) {
            const match = line.trim().match(rxStart);
            if (match) {
                ingredients.push(at - 1);
            } else if (line.trim().match(informal)) {
                ingredients.push(at - 1);
            }
        }
    });
    return { ingredients, instructions };
};

module.exports = { parse, fractions, detectLists, rawToDeltas, detectIngredients };
