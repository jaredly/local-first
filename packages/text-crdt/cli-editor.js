var blessed = require('blessed'),
    program = blessed.program();

const state = { text: '', mode: 'insert', pos: 0 };

program.on('keypress', function(ch, evt) {
    if (evt.full === 'enter' || evt.full === 'return') {
        return;
    }
    if (state.mode === 'insert') {
        if (evt.full === 'escape') {
            state.mode = 'normal';
            program.selData(2, 3);
            debug(state);
            return;
        }
        if (evt.full === 'backspace') {
            state.pos -= 1;
            program.move(state.pos, 0);
            state.text =
                state.text.slice(0, state.pos) +
                state.text.slice(state.pos + 1);
            program.deleteChars(1);
            debug(state);
            return;
        }
        if (!ch) {
            return;
        }
        state.text =
            state.text.slice(0, state.pos) + ch + state.text.slice(state.pos);
        if (state.pos < state.text.length) {
            program.insertChars(1);
        }
        program.write(ch);
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
            program.deleteChars(1);
            state.text =
                state.text.slice(0, state.pos) +
                state.text.slice(state.pos + 1);
        }
    }
    debug(state);
    program.move(state.pos, 0);
});

const debug = state => {
    program.cursorShape(state.mode === 'insert' ? 'line' : 'block');
    program.cursorColor(9);
    program.move(0, 5);
    program.eraseInLine(2);
    program.write(state.text);
    program.move(state.pos, 0);
};

program.key('q', function(ch, key) {
    program.clear();
    program.disableMouse();
    // program.showCursor();
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

program.alternateBuffer();
// program.enableMouse();
// program.hideCursor();
program.clear();

program.move(0, 0);
program.write('m');
// program.bg('black');
// program.write('Hello world', 'blue fg');
// program.setx(((program.cols / 2) | 0) - 4);
// program.down(5);
// program.write('Hi again!');
// program.bg('!black');
program.feed();
