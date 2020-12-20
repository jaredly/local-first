// @flow

const poller = (time: number, fn: () => Promise<void>) => {
    let tid = null;
    const poll = () => {
        // console.log('poll');
        clearTimeout(tid);
        fn()
            .catch(() => {})
            .then(() => {
                tid = setTimeout(poll, time);
            });
    };
    if (globalThis.document) {
        document.addEventListener(
            'visibilitychange',
            () => {
                if (document.hidden) {
                    clearTimeout(tid);
                } else {
                    poll();
                }
            },
            false,
        );
        window.addEventListener(
            'focus',
            () => {
                poll();
            },
            false,
        );
    }
    return poll;
};

export default poller;
