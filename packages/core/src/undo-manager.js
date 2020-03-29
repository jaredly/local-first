// @flow

// TODO this should probably be a little more intellident, so that we could potentially persist the undo history.
export const create = () => {
    const history: Array<Array<() => mixed>> = [];
    let pending = [];
    let timer = null;
    return {
        add(fn: () => mixed) {
            pending.push(fn);
            if (!timer) {
                timer = setTimeout(() => {
                    timer = null;
                    if (pending.length) {
                        console.log('new history');
                        history.push(pending);
                    }
                    pending = [];
                }, 0);
            }
        },
        undo() {
            if (pending.length) {
                pending.forEach(fn => fn());
                pending = [];
            }
            if (history.length) {
                const last = history.shift();
                last.forEach(fn => fn());
            }
        },
    };
};
