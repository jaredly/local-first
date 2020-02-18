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
    sync: Array<crdt.Delta<Format>>,
    sel: {anchor: number, cursor: number},
    mode: 'insert' | 'normal' | 'visual',
    pos: number,
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
    const { cursor, anchor } = selection;
    const at = Math.min(cursor, anchor);
    const count = Math.max(cursor, anchor) - at + 1;
    return { at, count };
};

const applyDelta = (state, delta) => {
    crdt.apply(state.text, delta, mergeFormats);
    state.sync.push(delta);
};

const draw = (state /*:State*/, pos) => {
    let text = '<type something>';
    if (state.mode === 'visual') {
        const { at, count } = sortCursor(state.sel);
        const c /*:crdt.CRDT<Format>*/ = crdt.inflate(
            state.text.site,
            clone(state.text.roots),
        );
        const delta = crdt.localFormat(c, at, count, { highlight: true });
        crdt.apply(c, delta, mergeFormats);
        text = crdt.toString(c, format);
        // program.move(0, 9);
        // program.eraseInLine(2);
        // program.write(
        //     JSON.stringify(crdt.selectionToSpans(state.text, at, count)),
        // );
    } else {
        text = crdt.toString(state.text, format);
    }

    program.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    program.move(0, pos);
    program.eraseInLine(2);
    program.write(text);
    program.move(state.sel.cursor, pos);
};

const debug = (state, pos) => {
    const plain = crdt.toString(state.text);
    program.move(0, pos);
    program.eraseInLine(2);
    program.write(crdt.toDebug(state.text));
    program.move(0, pos + 1);
    program.eraseInLine(2);
    program.write(
        `Cached: ${length(state.text)} - Full: ${plain.length} - Mode: ${
            state.mode
        } - Cursor: ${JSON.stringify(state.sel)}`,
    );
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

const visualFormat = (state, format) => {
    const { at, count } = sortCursor(state.sel);
    applyDelta(state, crdt.localFormat(state.text, at, count, format));
    state.mode = 'normal';
    state.sel = { anchor: at, cursor: at };
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
            visualFormat(state, { bold: true });
        }
        if (ch === 'u') {
            visualFormat(state, { underline: true });
        }
        if (ch === 'd' || ch === 'x') {
            const { at, count } = sortCursor(state.sel);
            applyDelta(state, crdt.localDelete(state.text, at, count));
            state.mode = 'normal';
            state.sel = { anchor: at, cursor: at };
        }
    } else if (state.mode === 'insert') {
        if (evt.full === 'escape') {
            state.mode = 'normal';
            return;
        }
        if (evt.full === 'backspace') {
            if (state.sel.cursor > 0) {
                moveSelRel(state, -1);
                // state.pos -= 1;
                applyDelta(
                    state,
                    crdt.localDelete(state.text, state.sel.cursor, 1),
                );
            }
            // state.text =
            //     state.text.slice(0, state.pos) +
            //     state.text.slice(state.pos + 1);
            return;
        }
        if (!ch) {
            return;
        }
        applyDelta(
            state,
            // TODO copy the format of the text under cursor.
            // Also TODO, establish a "bias", so if you came from the left,
            // you get the left format, and if you come from the right,
            // you get the right's
            crdt.localInsert(state.text, state.sel.cursor, ch, null),
        );
        // state.text =
        //     state.text.slice(0, state.pos) + ch + state.text.slice(state.pos);
        // state.pos += 1;
        moveSelRel(state, 1);
    } else {
        if (ch === 'A') {
            moveSel(state, length(state.text));
            state.mode = 'insert';
            return;
        }
        if (ch === '0') {
            moveSel(state, 0);
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
                applyDelta(
                    state,
                    crdt.localDelete(state.text, state.sel.cursor, 1),
                );
            }
        }
    }
};

const stateA /*:State*/ = {
    text: crdt.init('a'),
    mode: 'normal',
    sel: { cursor: 0, anchor: 0 },
    sync: [],
    pos: 0,
};

crdt.apply(
    stateA.text,
    crdt.localInsert(
        stateA.text,
        0,
        'Hello folks, this is the editor extraordinaire.',
    ),
    mergeFormats,
);

const stateB /*:State*/ = {
    text: crdt.inflate('b', clone(stateA.text.roots)),
    mode: 'normal',
    sync: [],
    sel: { cursor: 0, anchor: 0 },
    pos: 10,
};

const programState = {
    editors: {
        a: stateA,
        b: stateB,
    },
    focused: 'a',
};

program.on('keypress', function(ch, evt) {
    if (evt.full === 'tab') {
        programState.focused = programState.focused === 'a' ? 'b' : 'a';
    }
    if (ch === 's') {
        // sync them!
        programState.editors.a.sync.forEach(delta => {
            crdt.apply(programState.editors.b.text, delta, mergeFormats);
        });
        programState.editors.b.sync.forEach(delta => {
            crdt.apply(programState.editors.a.text, delta, mergeFormats);
        });
        programState.editors.a.sync = [];
        programState.editors.b.sync = [];
        fullRefresh();
        return;
    }
    const editor = programState.editors[programState.focused];
    handleKeyPress(editor, ch, evt);
    debug(editor, editor.pos + 5);
    draw(editor, editor.pos);
});

program.key('q', function(ch, key) {
    program.clear();
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

const fullRefresh = () => {
    Object.keys(programState.editors).forEach(key => {
        const editor = programState.editors[key];
        debug(editor, editor.pos + 5);
        draw(editor, editor.pos);
    });
    const editor = programState.editors[programState.focused];
    draw(editor, editor.pos);
};

program.alternateBuffer();
program.clear();
fullRefresh();
