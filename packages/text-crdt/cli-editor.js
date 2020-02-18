// @flow
require('@babel/register');
const crdt = require('./tree');
const chalk = require('chalk');
var blessed = require('blessed'),
    program = blessed.program();

const clone = m => JSON.parse(JSON.stringify(m));
/*::
type Format = {
    bold?: boolean,
    underline?: boolean,
    highlight?: boolean,
}
type State = {
    text: crdt.CRDT<Format>,
    sel: {anchor: number, cursor: number},
    mode: 'insert' | 'normal',
}
*/

const format = (text, format) => {
    if (format.bold) {
        text = chalk.bold(text);
    }
    if (format.underline) {
        text = chalk.underline(text);
    }
    if (format.highlight) {
        text = chalk.bgWhite.black(text);
    }
    return text;
};

const mergeFormats = (a, b) => Object.assign({}, a, b);

const draw = (state /*:State*/) => {
    program.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    program.cursorColor('red');
    program.move(0, 0);
    program.eraseInLine(2);
    // program.bg('red');

    // TODO how do I do a highlight overlay?
    // If it was immutable, I could just add a "format" command right here ....
    let text = '<type something>';
    if (state.sel.cursor !== state.sel.anchor) {
        const { cursor, anchor } = state.sel;
        const first = Math.min(cursor, anchor);
        const count = Math.max(cursor, anchor) - first;
        const c = clone(state.text);
        crdt.apply(
            c,
            crdt.localFormat(c, first, count, { highlight: true }),
            mergeFormats,
        );
        text = crdt.toString(c, format);
    } else {
        text = crdt.toString(state.text, format);
    }

    program.write(text);
    program.write(chalk.bold('blded'));
    // program.bg('!red');
    program.move(state.sel.cursor, 0);
};

const moveSel = (state, pos) => {
    state.sel.cursor = pos;
    state.sel.anchor = pos;
};
const moveSelRel = (state, diff) => {
    state.sel.cursor += diff;
    state.sel.anchor = state.sel.cursor;
};

const length = state => {
    let res = 0;
    state.roots.forEach(r => (res += r.size));
    return res;
};

const handleKeyPress = (state /*:State*/, ch, evt) => {
    if (evt.full === 'enter' || evt.full === 'return') {
        return;
    }
    if (state.mode === 'insert') {
        if (evt.full === 'escape') {
            state.mode = 'normal';
            return;
        }
        if (evt.full === 'backspace') {
            moveSelRel(state, -1);
            // state.pos -= 1;
            crdt.apply(
                state.text,
                crdt.localDelete(state.text, state.sel.cursor + 1, 1),
                mergeFormats,
            );
            // state.text =
            //     state.text.slice(0, state.pos) +
            //     state.text.slice(state.pos + 1);
            return;
        }
        if (!ch) {
            return;
        }
        crdt.apply(
            state.text,
            // TODO copy the format of the text under cursor.
            // Also TODO, establish a "bias", so if you came from the left,
            // you get the left format, and if you come from the right,
            // you get the right's
            crdt.localInsert(state.text, state.sel.cursor, ch, null),
            mergeFormats,
        );
        // state.text =
        //     state.text.slice(0, state.pos) + ch + state.text.slice(state.pos);
        // state.pos += 1;
        moveSelRel(state, 1);
    } else {
        if (ch === 'h' || evt.full === 'left') {
            if (state.sel.cursor > 0) {
                moveSelRel(state, -1);
                // state.pos -= 1;
            }
        }
        if (ch === 'l' || evt.full === 'right') {
            if (state.sel.cursor < length(state.text)) {
                moveSelRel(state, 1);
                // state.pos += 1;
            }
        }
        if (ch === 'i') {
            state.mode = 'insert';
        }
        if (ch === 'a') {
            if (state.sel.cursor < length(state.text)) {
                // state.pos += 1;
                moveSelRel(state, 1);
            }
            state.mode = 'insert';
        }
        if (ch === 'x') {
            crdt.apply(
                state.text,
                crdt.localDelete(state.text, state.sel.cursor + 1, 1),
                mergeFormats,
            );
            // state.text =
            //     state.text.slice(0, state.pos) +
            //     state.text.slice(state.pos + 1);
        }
    }
};

const state /*:State*/ = {
    text: crdt.init('a'),
    mode: 'insert',
    sel: { cursor: 0, anchor: 0 },
};

program.on('keypress', function(ch, evt) {
    handleKeyPress(state, ch, evt);
    debug(state);
    draw(state);
});

const debug = state => {
    program.move(0, 5);
    program.eraseInLine(2);
    const plain = crdt.toString(state.text);
    program.write(crdt.toDebug(state.text));
    program.move(0, 6);
    program.eraseInLine(2);
    program.write(`Cached: ${length(state.text)} - Full: ${plain.length}`);
};

program.key('q', function(ch, key) {
    program.clear();
    program.disableMouse();
    program.cursorShape('block');
    program.normalBuffer();
    process.exit(0);
});

program.on('mouse', function(data) {
    if (data.action === 'mousemove') {
        program.move(data.x, data.y);
        program.bg('red');
        program.write('x');
        program.bg('!red');
    }
});

setTimeout(() => {
    program.alternateBuffer();
    program.clear();
    draw(state);
    program.feed();
}, 5);
