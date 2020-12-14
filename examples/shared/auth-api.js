// @flow

const listeners = [];

export type Data = { user: { name: string, email: string }, token: string };
export type Status = false | null | Data;

export const initialStatus = (storageKey: string): Status => {
    const raw = localStorage.getItem(storageKey);
    if (raw != null) {
        try {
            const { user, token } = JSON.parse(raw);
            if (!user || !token) {
                throw new Error(`Unexpected data`);
            }
            console.log('initial loaded status', user, token, storageKey);
            return { user, token };
        } catch {
            return false;
        }
    } else {
        return false;
    }
};

export const listen = (fn: (data: Status) => mixed) => {
    listeners.push(fn);
    return () => {
        const idx = listeners.indexOf(fn);
        if (idx !== -1) {
            listeners.splice(idx, 1);
        }
    };
};

export const checkEmail = async (host: string, email: string) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(
        `${window.location.protocol}//${host}/api/check-login?email=${encodeURIComponent(email)}`,
    );
    return res.status >= 200 && res.status < 300;
};

const processResponse = async (storageKey: string, res, sentToken: ?string) => {
    if (res.status !== 200 && res.status !== 204) {
        throw new Error(await res.text());
    }
    const token =
        sentToken == null || sentToken.length == 0 ? res.headers.get('X-Session') : sentToken;
    if (token == null) {
        localStorage.removeItem(storageKey);
        listeners.forEach(fn => fn(false));
        return null;
    }
    const user = await res.json();
    const auth = { user, token };
    localStorage.setItem(storageKey, JSON.stringify(auth));
    listeners.forEach(fn => fn(auth));
    return auth;
};

export const getUser = async (storageKey: string, host: string, token: string) => {
    // TODO figure out what the behavior is here if we're offline
    let res;
    try {
        res = await fetch(`${window.location.protocol}//${host}/api/user`, {
            headers: { Authorization: `Bearer: ${token}` },
        });
    } catch {
        return false;
    }
    if (res.status === 401) {
        localStorage.removeItem(storageKey);
        listeners.forEach(fn => fn(false));
        throw new Error(`Not logged in`);
    }
    return processResponse(storageKey, res, token);
};

export const logout = async (storageKey: string, host: string, token: string) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(`${window.location.protocol}//${host}/api/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer: ${token}` },
    });
    processResponse(storageKey, res);
};

export const login = async (storageKey: string, host: string, email: string, password: string) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(`${window.location.protocol}//${host}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return processResponse(storageKey, res);
};

export const signup = async (
    storageKey: string,
    host: string,
    email: string,
    password: string,
    name: string,
    invite: ?string,
) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(`${window.location.protocol}//${host}/api/signup`, {
        method: 'POST',
        body: JSON.stringify({ email, password, name, invite }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return processResponse(storageKey, res);
};
