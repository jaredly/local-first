// @flow
require('@babel/register');
const crdt = require('./tree');
const chalk = require('chalk');
var blessed = require('blessed'),
    program = blessed.program();

/*::
type Format = {
    bold?: boolean,
    underline?: boolean,
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
    return text;
};

const draw = state => {
    program.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    program.cursorColor('red');
    program.move(0, 0);
    program.eraseInLine(2);
    // program.bg('red');
    program.write(state.text ? chalk.bgRed(state.text) : '<type something>');
    program.write(chalk.bold('blded'));
    // program.bg('!red');
    program.move(state.pos, 0);
};

const handleKeyPress = (state, ch, evt) => {
    if (evt.full === 'enter' || evt.full === 'return') {
        return;
    }
    if (state.mode === 'insert') {
        if (evt.full === 'escape') {
            state.mode = 'normal';
            return;
        }
        if (evt.full === 'backspace') {
            state.pos -= 1;
            state.text =
                state.text.slice(0, state.pos) +
                state.text.slice(state.pos + 1);
            return;
        }
        if (!ch) {
            return;
        }
        state.text =
            state.text.slice(0, state.pos) + ch + state.text.slice(state.pos);
        state.pos += 1;
    } else {
        if (ch === 'h' || evt.full === 'left') {
            if (state.pos > 0) {
                state.pos -= 1;
            }
        }
        if (ch === 'l' || evt.full === 'right') {
            if (state.pos < state.text.length) {
                state.pos += 1;
            }
        }
        if (ch === 'i') {
            state.mode = 'insert';
        }
        if (ch === 'a') {
            if (state.pos < state.text.length) {
                state.pos += 1;
            }
            state.mode = 'insert';
        }
        if (ch === 'x') {
            state.text =
                state.text.slice(0, state.pos) +
                state.text.slice(state.pos + 1);
        }
    }
};

const state = { text: '', mode: 'insert', pos: 0 };

program.on('keypress', function(ch, evt) {
    handleKeyPress(state, ch, evt);
    debug(state);
    draw(state);
});

const debug = state => {
    program.move(0, 5);
    program.eraseInLine(2);
    program.write(state.text);
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
