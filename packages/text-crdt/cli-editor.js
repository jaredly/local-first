// @flow
require('@babel/register');
const crdt = require('./tree');

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
    const chalk = require('chalk');
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

const draw = (cli, state /*:State*/, pos) => {
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
        cli.move(0, pos + 1);
        cli.eraseInLine(2);
        cli.write(JSON.stringify(crdt.selectionToSpans(state.text, at, count)));
    } else {
        text = crdt.toString(state.text, format);
    }

    cli.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    cli.move(0, pos);
    cli.eraseInLine(2);
    cli.write(text);
    cli.move(state.sel.cursor, pos);
};

const debug = (cli, state, pos) => {
    const plain = crdt.toString(state.text);
    cli.move(0, pos);
    cli.eraseInLine(2);
    cli.write(crdt.toDebug(state.text));
    cli.move(0, pos + 1);
    cli.eraseInLine(2);
    cli.write(
        `Cached: ${crdt.length(state.text)} - Full: ${plain.length} - Mode: ${
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

const visualFormat = (state, format) => {
    const { at, count } = sortCursor(state.sel);
    applyDelta(state, crdt.localFormat(state.text, at, count, format));
    state.mode = 'normal';
    state.sel = { anchor: at, cursor: at };
};

const handleKeyPress2 = (mode, length, sel, ch, evt) => {
    if (evt.full === 'tab') {
        return [{ type: 'tab' }];
    }
    if (mode === 'normal' && ch === 's') {
        return [{ type: 'sync' }];
    }

    if (evt.full === 'enter' || evt.full === 'return') {
        return [];
    }
    if (mode === 'visual') {
        if (ch === 'h' || evt.full === 'left') {
            if (sel.cursor > 0) {
                return [{ type: 'selrel', rel: -1, keep: true }];
                // moveSelRel(sel, -1, false);
            }
        }
        if (ch === 'l' || evt.full === 'right') {
            if (sel.cursor < length) {
                // moveSelRel(sel, 1, false);
                return [{ type: 'selrel', rel: 1, keep: true }];
            }
        }
        if (evt.full === 'escape') {
            // sel.anchor = sel.cursor;
            return [
                { type: 'mode', mode: 'normal' },
                { type: 'sel', sel: sel.cursor },
            ];
            // state.mode = 'normal';
            // return;
        }
        if (ch === 'b') {
            const { at, count } = sortCursor(sel);
            return [
                { type: 'format', format: { bold: true }, at, count },
                { type: 'mode', mode: 'normal' },
                { type: 'sel', sel: at },
            ];
            // visualFormat(state, { bold: true });
        }
        if (ch === 'u') {
            const { at, count } = sortCursor(sel);
            return [
                { type: 'format', format: { underline: true }, at, count },
                { type: 'mode', mode: 'normal' },
                { type: 'sel', sel: at },
            ];
            // visualFormat(state, { underline: true });
        }
        if (ch === 'd' || ch === 'x') {
            const { at, count } = sortCursor(sel);
            // sel.anchor = at
            // sel.cursor = at
            // sel = { anchor: at, cursor: at };
            return [
                { type: 'mode', mode: 'normal' },
                { type: 'delete', at, count },
                { type: 'sel', sel: at },
            ];
            // applyDelta(state, crdt.localDelete(state.text, at, count));
            // state.mode = 'normal';
            // state.sel = { anchor: at, cursor: at };
        }
    } else if (mode === 'insert') {
        if (evt.full === 'escape') {
            // state.mode = 'normal';
            return [{ type: 'mode', mode: 'normal' }];
        }
        if (evt.full === 'backspace') {
            if (sel.cursor > 0) {
                return [
                    { type: 'selrel', rel: -1 },
                    { type: 'delete', at: sel.cursor - 1, count: 1 },
                ];
                // moveSelRel(sel, -1);rel: -1
                // applyDelta(
                //     state,
                //     crdt.localDelete(state.text, state.sel.cursor, 1),
                // );
            }
            return [];
        }
        if (!ch) {
            return [];
        }
        return [
            { type: 'insert', text: ch, at: sel.cursor },
            { type: 'selrel', rel: 1 },
        ];
        // applyDelta(
        //     state,
        //     // TODO copy the format of the text under cursor.
        //     // Also TODO, establish a "bias", so if you came from the left,
        //     // you get the left format, and if you come from the right,
        //     // you get the right's
        //     crdt.localInsert(state.text, state.sel.cursor, ch, null),
        // );
        // moveSelRel(sel, 1);
    } else {
        if (ch === 'A') {
            // moveSel(state, length);
            // state.mode = 'insert';
            return [
                { type: 'sel', sel: length },
                { type: 'mode', mode: 'insert' },
            ];
        }
        if (ch === '$') {
            return [{ type: 'sel', sel: length }];
        }
        if (ch === '0') {
            return [{ type: 'sel', sel: 0 }];
        }
        if (ch === 'h' || evt.full === 'left') {
            if (sel.cursor > 0) {
                // moveSelRel(sel, -1);
                return [{ type: 'selrel', rel: -1 }];
            }
        }
        if (ch === 'l' || evt.full === 'right') {
            if (sel.cursor < length) {
                // moveSelRel(sel, 1);
                return [{ type: 'selrel', rel: 1 }];
            }
        }
        if (ch === 'v') {
            const actions = [{ type: 'mode', mode: 'visual' }];
            // state.mode = 'visual';
            if (sel.cursor === length) {
                // moveSel(state, length - 1);
                actions.push({ type: 'sel', sel: length - 1 });
            }
            return actions;
        }
        if (ch === 'i') {
            // state.mode = 'insert';
            return [{ type: 'mode', mode: 'insert' }];
        }
        if (ch === 'a') {
            const actions = [{ type: 'mode', mode: 'insert' }];
            if (sel.cursor < length) {
                actions.push({ type: 'selrel', rel: 1 });
                // moveSelRel(sel, 1);
            }
            // state.mode = 'insert';
            return actions;
        }
        if (ch === 'x') {
            if (sel.cursor < length) {
                // applyDelta(
                //     state,
                //     crdt.localDelete(state.text, state.sel.cursor, 1),
                // );
                return [{ type: 'delete', at: sel.cursor, count: 1 }];
            }
        }
    }
    return [];
};

// const handleKeyPress = (state /*:State*/, ch, evt) => {
//     if (evt.full === 'enter' || evt.full === 'return') {
//         return;
//     }
//     if (state.mode === 'visual') {
//         if (ch === 'h' || evt.full === 'left') {
//             if (state.sel.cursor > 0) {
//                 moveSelRel(state, -1, false);
//             }
//         }
//         if (ch === 'l' || evt.full === 'right') {
//             if (state.sel.cursor < crdt.length(state.text)) {
//                 moveSelRel(state, 1, false);
//             }
//         }
//         if (evt.full === 'escape') {
//             state.mode = 'normal';
//             state.sel.anchor = state.sel.cursor;
//             return;
//         }
//         if (ch === 'b') {
//             visualFormat(state, { bold: true });
//         }
//         if (ch === 'u') {
//             visualFormat(state, { underline: true });
//         }
//         if (ch === 'd' || ch === 'x') {
//             const { at, count } = sortCursor(state.sel);
//             applyDelta(state, crdt.localDelete(state.text, at, count));
//             state.mode = 'normal';
//             state.sel = { anchor: at, cursor: at };
//         }
//     } else if (state.mode === 'insert') {
//         if (evt.full === 'escape') {
//             state.mode = 'normal';
//             return;
//         }
//         if (evt.full === 'backspace') {
//             if (state.sel.cursor > 0) {
//                 moveSelRel(state, -1);
//                 applyDelta(
//                     state,
//                     crdt.localDelete(state.text, state.sel.cursor, 1),
//                 );
//             }
//             return;
//         }
//         if (!ch) {
//             return;
//         }
//         applyDelta(
//             state,
//             // TODO copy the format of the text under cursor.
//             // Also TODO, establish a "bias", so if you came from the left,
//             // you get the left format, and if you come from the right,
//             // you get the right's
//             crdt.localInsert(state.text, state.sel.cursor, ch, null),
//         );
//         moveSelRel(state, 1);
//     } else {
//         if (ch === 'A') {
//             moveSel(state, crdt.length(state.text));
//             state.mode = 'insert';
//             return;
//         }
//         if (ch === '0') {
//             moveSel(state, 0);
//             return;
//         }
//         if (ch === 'h' || evt.full === 'left') {
//             if (state.sel.cursor > 0) {
//                 moveSelRel(state, -1);
//             }
//         }
//         if (ch === 'l' || evt.full === 'right') {
//             if (state.sel.cursor < crdt.length(state.text)) {
//                 moveSelRel(state, 1);
//             }
//         }
//         if (ch === 'v') {
//             state.mode = 'visual';
//             if (state.sel.cursor === crdt.length(state.text)) {
//                 moveSel(state, crdt.length(state.text) - 1);
//             }
//         }
//         if (ch === 'i') {
//             state.mode = 'insert';
//         }
//         if (ch === 'a') {
//             if (state.sel.cursor < crdt.length(state.text)) {
//                 moveSelRel(state, 1);
//             }
//             state.mode = 'insert';
//         }
//         if (ch === 'x') {
//             if (state.sel.cursor < crdt.length(state.text)) {
//                 applyDelta(
//                     state,
//                     crdt.localDelete(state.text, state.sel.cursor, 1),
//                 );
//             }
//         }
//     }
// };

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

const sync = programState => {
    const { a, b } = programState.editors;
    // sync them!
    // const aCursor = a.sel.cursor;
    const aPlace = crdt.parentLocForPos(a.text, a.sel.cursor);
    const bPlace = crdt.parentLocForPos(b.text, b.sel.cursor);
    if (aPlace) {
        const res = crdt.textPositionForLoc(a.text, aPlace);
        if (res !== a.sel.cursor) {
            console.log(res, a.sel.cursor, aPlace);
            throw new Error('Failure!');
        }
    }
    a.sync.forEach(delta => {
        const pre = crdt.toDebug(b.text);
        crdt.apply(b.text, delta, mergeFormats);
        try {
            crdt.checkConsistency(b.text);
        } catch (err) {
            console.log('b', JSON.stringify(delta));
            console.log(pre);
            console.log(crdt.toDebug(b.text));
            throw err;
        }
    });
    b.sync.forEach(delta => {
        crdt.apply(a.text, delta, mergeFormats);
        try {
            crdt.checkConsistency(a.text);
        } catch (err) {
            console.log('a', JSON.stringify(delta));
            console.log(crdt.toDebug(a.text));
            throw err;
        }
    });
    if (aPlace) {
        a.sel.cursor = crdt.textPositionForLoc(a.text, aPlace);
    }
    if (bPlace) {
        b.sel.cursor = crdt.textPositionForLoc(b.text, bPlace);
    }
    a.sync = [];
    b.sync = [];
};

const handleAction = (programState, editor, action) => {
    switch (action.type) {
        case 'sync':
            return sync(programState);
        case 'tab':
            programState.focused = programState.focused === 'a' ? 'b' : 'a';
            return;
        case 'mode':
            editor.mode = action.mode;
            return;
        case 'sel':
            editor.sel.cursor = action.sel;
            editor.sel.anchor = action.sel;
            return;
        case 'selrel':
            editor.sel.cursor += action.rel;
            if (!action.keep) {
                editor.sel.anchor = editor.sel.cursor;
            }
            return;
        case 'format':
            applyDelta(
                editor,
                crdt.localFormat(
                    editor.text,
                    action.at,
                    action.count,
                    action.format,
                ),
            );
            // editor.mode = 'normal';
            // state.sel = { anchor: at, cursor: at };
            return;
        case 'delete':
            applyDelta(
                editor,
                crdt.localDelete(editor.text, action.at, action.count),
            );
            return;
        case 'insert':
            applyDelta(
                editor,
                // TODO copy the format of the text under cursor.
                // Also TODO, establish a "bias", so if you came from the left,
                // you get the left format, and if you come from the right,
                // you get the right's
                crdt.localInsert(editor.text, action.at, action.text),
            );
            return;
        default:
            throw new Error('done');
    }
};

const cleanState = programState => ({
    ...programState,
    editors: {
        a: {
            ...programState.editors.a,
            text: programState.editors.a.text.roots,
        },
        b: {
            ...programState.editors.b,
            text: programState.editors.b.text.roots,
        },
    },
});

let logFile = __dirname + '/actions.log.txt';
const fs = require('fs');
if (fs.existsSync(logFile)) {
    for (let i = 0; i < 100; i++) {
        const full = __dirname + `/actions-${i}.log.txt`;
        if (!fs.existsSync(full)) {
            console.log('new actions file', full);
            logFile = full;
            break;
        }
    }
}

const log = data => {
    require('fs').appendFileSync(logFile, JSON.stringify(data) + '\n');
};

const cli = require('blessed').program();

cli.on('keypress', function(ch, evt) {
    try {
        const editor = programState.editors[programState.focused];
        const actions = handleKeyPress2(
            editor.mode,
            crdt.length(editor.text),
            editor.sel,
            ch,
            evt,
        );
        log(actions);
        actions.forEach(action => handleAction(programState, editor, action));
        log(cleanState(programState));

        debug(cli, editor, editor.pos + 5);
        draw(cli, editor, editor.pos);
        const newEditor = programState.editors[programState.focused];

        if (editor !== newEditor) {
            debug(cli, newEditor, newEditor.pos + 5);
            draw(cli, newEditor, newEditor.pos);
        }
        if (actions.some(a => a.type === 'sync')) {
            fullRefresh();
        }
    } catch (err) {
        cli.cursorShape('block');
        cli.normalBuffer();
        console.error(err.stack);
        process.exit(0);
    }
});

cli.key('q', function(ch, key) {
    cli.clear();
    cli.cursorShape('block');
    cli.normalBuffer();
    // We exited gracefully, it's fine
    require('fs').unlinkSync(logFile);
    process.exit(0);
});

const fullRefresh = () => {
    Object.keys(programState.editors).forEach(key => {
        const editor = programState.editors[key];
        debug(cli, editor, editor.pos + 5);
        draw(cli, editor, editor.pos);
    });
    const editor = programState.editors[programState.focused];
    draw(cli, editor, editor.pos);
};

const [_, __, toLoad] = process.argv;
if (toLoad) {
    const text = fs.readFileSync(toLoad, 'utf8').split('\n');
    for (let i = 0; i < text.length; i += 2) {
        const actions = JSON.parse(text[i]);
        try {
            actions.forEach(action =>
                handleAction(
                    programState,
                    programState.editors[programState.focused],
                    action,
                ),
            );
            crdt.checkConsistency(programState.editors.a.text);
            crdt.checkConsistency(programState.editors.b.text);
        } catch (err) {
            console.log(`Got to line ${i}`);
            console.log(text[i]);
            console.error(err.stack);
            process.exit(0);
        }
    }
}

cli.alternateBuffer();
cli.clear();

fullRefresh();
