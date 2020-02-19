// @flow

export type Format = {|
    bold?: boolean,
    underline?: boolean,
    highlight?: boolean,
|};

export const mergeFormats = (a /*:Format*/, b /*:Format*/) /*:Format*/ =>
    (Object.assign({}, a, b) /*: any*/);
