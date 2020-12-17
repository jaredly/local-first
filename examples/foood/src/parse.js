// @flow

export const fractions = {
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
console.log(fullRaw);
const rx = new RegExp(fullRaw, 'g');

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

export const parse = (text: string) => {
    // how do ingredients work?
    // first, we've got "numbers and units"
    // yeah, so we can format them as something special
    // and then we can think about other things
    // console.log('(parsing)', text);
    return getNumbers(text);
};
