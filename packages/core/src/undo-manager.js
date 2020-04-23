// @flow

// TODO this should probably be a little more intellident, so that we could potentially persist the undo history.
export const create = () => {
    const history: Array<Array<() => mixed>> = [];
    let pending = [];
    let timer = null;
    return {
        add(fn: () => mixed) {
            // console.log('add undo');
            pending.push(fn);
            if (!timer) {
                timer = setTimeout(() => {
                    timer = null;
                    if (pending.length) {
                        // console.log('new history', pending.length);
                        history.push(pending);
                    }
                    pending = [];
                }, 0);
            }
        },
        undo() {
            if (pending.length) {
                // console.log('undo pending', pending.length);
                pending.forEach(fn => fn());
                pending = [];
            }
            if (history.length) {
                const last = history.pop();
                // console.log('undo', last.length);
                last.forEach(fn => fn());
            }
        },
    };
};
