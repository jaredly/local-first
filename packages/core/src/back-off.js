// @flow

const backOff = (
    fn: () => Promise<boolean>,
    wait: number = 200,
    rate: number = 1.5,
    initialWait: number = wait,
) => {
    fn()
        .catch(err => false)
        .then(succeeded => {
            if (succeeded) {
                return;
            } else if (globalThis.document != undefined) {
                const tid = setTimeout(() => {
                    document.removeEventListener('visibilitychange', listener, false);
                    backOff(fn, wait * rate, rate, initialWait);
                }, wait);

                const listener = () => {
                    if (!document.hidden) {
                        document.removeEventListener('visibilitychange', listener, false);
                        clearTimeout(tid);
                        backOff(fn, initialWait, rate, initialWait);
                    }
                };

                if (wait > 1000) {
                    document.addEventListener('visibilitychange', listener, false);
                }
            } else {
                backOff(fn, wait * rate, rate, initialWait);
            }
        });
};

// function handleVisibilityChange() {
//   if (document.hidden) {
//     pauseSimulation();
//   } else  {
//     startSimulation();
//   }
// }

// document.addEventListener("visibilitychange", handleVisibilityChange, false);

export default backOff;
