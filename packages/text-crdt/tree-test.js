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

// const state /*:CRDT<Format>*/ = crdt.init('a', []);
// console.log(crdt.toString(state), crdt.toDebug(state));
// const d1 = crdt.localInsert(state, 0, 'hello', null);
// crdt.apply(state, d1, noop);
// console.log(crdt.toString(state), crdt.toDebug(state));
// // console.log(crdt.locForPos(state, 0));
// // console.log(crdt.locForPos(state, 1));
// // console.log(crdt.locForPos(state, 2));
// const d2 = crdt.localInsert(state, 2, 'world', null);
// console.log(d2);
// crdt.apply(state, d2, noop);
// console.log(crdt.toString(state), crdt.toDebug(state));
// crdt.apply(state, crdt.localFormat(state, 2, 2, { bold: true }), (a, b) =>
//     Object.assign({}, a, b),
// );

// console.log(crdt.toString(state, format), crdt.toDebug(state));
const deepEqual = require('@birchill/json-equalish').default;

const state /*:CRDT<Format>*/ = crdt.init('a');
const deltas = [
    state => crdt.localInsert(state, 0, 'A'),
    state => crdt.localInsert(state, 1, 'B'),
    state => crdt.localInsert(state, 2, 'C'),
    state => crdt.localInsert(state, 3, 'D'),
    state => crdt.localFormat(state, 2, 2, { underline: true }),
];
deltas.forEach(maker => {
    const delta = maker(state);
    crdt.apply(state, delta, noop);
    console.log(JSON.stringify(delta));
    console.log(crdt.toString(state, format), crdt.toDebug(state));
});

const aState = crdt.init('a');
crdt.apply(aState, crdt.localInsert(aState, 0, 'hello folks'), noop);
const bState = crdt.inflate('b', JSON.parse(JSON.stringify(aState.roots)));
const a = [state => crdt.localInsert(state, 3, 'abc')];
const b = [state => crdt.localInsert(state, 3, '123')];

const aSync = [];
const bSync = [];
a.forEach(delta => {
    const d = delta(aState);
    aSync.push(d);
    crdt.apply(aState, d, noop);
});
b.forEach(delta => {
    const d = delta(bState);
    bSync.push(d);
    crdt.apply(bState, d, noop);
});
aSync.forEach(delta => crdt.apply(bState, delta, noop));
bSync.forEach(delta => crdt.apply(aState, delta, noop));

if (!deepEqual(aState.roots, bState.roots)) {
    console.log('Not equal after syncing');
    console.log(crdt.toDebug(aState));
    console.log(crdt.toDebug(bState));
}

for (let i = 0; i < crdt.length(aState); i++) {
    const aPos = crdt.parentLocForPos(aState, i);
    if (!aPos) {
        throw new Error(`Invalid position ${i}`);
    }
    const back = crdt.textPositionForLoc(aState, aPos);
    if (i !== back) {
        console.log(`# Mismatch (${i})`);
        console.log(crdt.toDebug(aState));
        console.log(aPos);
        console.log(back);
    }
}
