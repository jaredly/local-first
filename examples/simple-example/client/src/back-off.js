// @flow

const backOff = (
    fn: () => Promise<boolean>,
    wait: number = 200,
    initialWait: number = wait,
    rate: number = 1.5,
) => {
    fn()
        .catch(err => false)
        .then(succeeded => {
            if (succeeded) {
                return;
            } else {
                const tid = setTimeout(() => {
                    document.removeEventListener(
                        'visibilitychange',
                        listener,
                        false,
                    );
                    backOff(fn, wait * rate, initialWait, rate);
                }, wait);

                const listener = () => {
                    if (!document.hidden) {
                        document.removeEventListener(
                            'visibilitychange',
                            listener,
                            false,
                        );
                        clearTimeout(tid);
                        backOff(fn, initialWait, initialWait, rate);
                    }
                };

                if (wait > 1000) {
                    document.addEventListener(
                        'visibilitychange',
                        listener,
                        false,
                    );
                }
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
