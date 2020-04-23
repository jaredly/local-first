// @flow
import * as React from 'react';

export const useLocalStorageState = function <T>(key: string, initial: T) {
    const [current, setCurrent] = React.useState(() => {
        const raw = localStorage[key];
        return raw == null ? initial : JSON.parse(raw);
    });
    const set = React.useCallback(
        (value: T) => {
            localStorage[key] = JSON.stringify(value);
            setCurrent(value);
        },
        [setCurrent],
    );
    return [current, set];
};

const sharedState = {};
const saveTimers = {};

export const useLocalStorageSharedToggle = (sharedKey: string, key: string) => {
    const [current, setCurrent] = React.useState(() => {
        if (sharedState[sharedKey] == null) {
            const raw = localStorage[sharedKey];
            sharedState[sharedKey] = raw == null ? {} : JSON.parse(raw);
        }
        return sharedState[sharedKey][key];
    });
    const set = React.useCallback(
        (value: boolean) => {
            if (value) {
                sharedState[sharedKey][key] = value;
            } else {
                delete sharedState[sharedKey][key];
            }
            if (!saveTimers[sharedKey]) {
                saveTimers[sharedKey] = setTimeout(() => {
                    saveTimers[sharedKey] = null;
                    localStorage[sharedKey] = JSON.stringify(sharedState[sharedKey]);
                }, 5);
            }
            setCurrent(value);
        },
        [setCurrent],
    );
    return [current, set];
};
