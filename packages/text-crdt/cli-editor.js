// @flow
require('@babel/register');
const crdt = require('./tree');
const chalk = require('chalk');
var blessed = require('blessed'),
    program = blessed.program();

const clone = crdt => JSON.parse(JSON.stringify(crdt));
/*::
type Format = {|
    bold?: boolean,
    underline?: boolean,
    highlight?: boolean,
|}
type State = {|
    text: crdt.CRDT<Format>,
    sel: {anchor: number, cursor: number},
    mode: 'insert' | 'normal' | 'visual',
|}
*/

const format = (text /*:string*/, format /*:Format*/) => {
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

const mergeFormats = (a /*:Format*/, b /*:Format*/) /*:Format*/ =>
    (Object.assign({}, a, b) /*: any*/);

const sortCursor = selection => {
    const { cursor, anchor } = state.sel;
    const at = Math.min(cursor, anchor);
    const count = Math.max(cursor, anchor) - at + 1;
    return { at, count };
};

const draw = (state /*:State*/) => {
    let text = '<type something>';
    if (state.mode === 'visual') {
        const { at, count } = sortCursor(state.sel);
        const c /*:crdt.CRDT<Format>*/ = crdt.inflate(
            'a',
            clone(state.text.roots),
        );
        const delta = crdt.localFormat(c, at, count, { highlight: true });
        crdt.apply(c, delta, mergeFormats);
        text = crdt.toString(c, format);
    } else {
        text = crdt.toString(state.text, format);
    }

    program.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    program.move(0, 0);
    program.eraseInLine(2);
    program.write(text);
    program.move(state.sel.cursor, 0);
};

const moveSel = (state, pos) => {
    state.sel.cursor = pos;
    state.sel.anchor = pos;
};
const moveSelRel = (state, diff, align = true) => {
    state.sel.cursor += diff;
    if (align) {
        state.sel.anchor = state.sel.cursor;
    }
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
    if (state.mode === 'visual') {
        if (ch === 'h' || evt.full === 'left') {
            if (state.sel.cursor > 0) {
                moveSelRel(state, -1, false);
            }
        }
        if (ch === 'l' || evt.full === 'right') {
            if (state.sel.cursor < length(state.text)) {
                moveSelRel(state, 1, false);
            }
        }
        if (evt.full === 'escape') {
            state.mode = 'normal';
            state.sel.anchor = state.sel.cursor;
            return;
        }
        if (ch === 'b') {
            const { at, count } = sortCursor(state.sel);
            crdt.apply(
                state.text,
                crdt.localFormat(state.text, at, count, { bold: true }),
                mergeFormats,
            );
            state.mode = 'normal';
            state.sel = { anchor: at, cursor: at };
        }
        if (ch === 'u') {
            const { at, count } = sortCursor(state.sel);
            crdt.apply(
                state.text,
                crdt.localFormat(state.text, at, count, { underline: true }),
                mergeFormats,
            );
            state.mode = 'normal';
            state.sel = { anchor: at, cursor: at };
        }
        if (ch === 'd' || ch === 'x') {
            const { at, count } = sortCursor(state.sel);
            crdt.apply(
                state.text,
                crdt.localDelete(state.text, at, count),
                mergeFormats,
            );
            state.mode = 'normal';
            state.sel = { anchor: at, cursor: at };
        }
    } else if (state.mode === 'insert') {
        if (evt.full === 'escape') {
            state.mode = 'normal';
            return;
        }
        if (evt.full === 'backspace') {
            moveSelRel(state, -1);
            // state.pos -= 1;
            crdt.apply(
                state.text,
                crdt.localDelete(state.text, state.sel.cursor, 1),
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
        if (ch === 'A') {
            moveSel(state, length(state.text));
            return;
        }
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
        if (ch === 'v') {
            state.mode = 'visual';
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
            if (state.sel.cursor < length(state.text)) {
                crdt.apply(
                    state.text,
                    crdt.localDelete(state.text, state.sel.cursor, 1),
                    mergeFormats,
                );
            }
        }
    }
};

const state /*:State*/ = {
    text: crdt.init('a'),
    mode: 'normal',
    sel: { cursor: 0, anchor: 0 },
};
crdt.apply(
    state.text,
    crdt.localInsert(
        state.text,
        0,
        'Hello folks, this is the editor extraordinaire.',
    ),
    mergeFormats,
);

program.on('keypress', function(ch, evt) {
    handleKeyPress(state, ch, evt);
    debug(state);
    draw(state);
});

const debug = state => {
    const plain = crdt.toString(state.text);
    program.move(0, 5);
    program.eraseInLine(2);
    program.write(crdt.toDebug(state.text));
    program.move(0, 6);
    program.eraseInLine(2);
    program.write(
        `Cached: ${length(state.text)} - Full: ${plain.length} - Mode: ${
            state.mode
        } - Cursor: ${JSON.stringify(state.sel)}`,
    );
};

program.key('q', function(ch, key) {
    program.clear();
    // program.disableMouse();
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
