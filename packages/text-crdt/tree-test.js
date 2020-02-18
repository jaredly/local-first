#!/usr/bin/env node
// @flow
require('@babel/register');

const crdt = require('./tree');

const noop = (a, b) => a;

/*::
import type {CRDT} from './tree'
type Format = {bold?: boolean, underline?: boolean}
 */

const chalk = require('chalk');
const format = (text, format) => {
    if (format.bold) {
        text = chalk.bold(text);
    }
    if (format.underline) {
        text = chalk.underline(text);
    }
    return text;
};

const state /*:CRDT<Format>*/ = crdt.init('a', []);
console.log(crdt.toString(state), crdt.toDebug(state));
const d1 = crdt.localInsert(state, 0, 'hello', null);
crdt.apply(state, d1, noop);
console.log(crdt.toString(state), crdt.toDebug(state));
// console.log(crdt.locForPos(state, 0));
// console.log(crdt.locForPos(state, 1));
// console.log(crdt.locForPos(state, 2));
const d2 = crdt.localInsert(state, 2, 'world', null);
console.log(d2);
crdt.apply(state, d2, noop);
console.log(crdt.toString(state), crdt.toDebug(state));
crdt.apply(state, crdt.localFormat(state, 2, 2, { bold: true }), (a, b) =>
    Object.assign({}, a, b),
);

console.log(crdt.toString(state, format), crdt.toDebug(state));
