// @flow

export const debounce = function<T>(fn: () => void): () => void {
    let waiting = false;
    return items => {
        if (!waiting) {
            waiting = true;
            setTimeout(() => {
                fn();
                waiting = false;
            }, 0);
        } else {
            console.log('bouncing');
        }
    };
};
