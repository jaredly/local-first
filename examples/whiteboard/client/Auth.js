// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

const listeners = [];

const processResponse = async (res, sentToken) => {
    if (res.status !== 200) {
        throw new Error(await res.text());
    }
    const user = await res.json();
    const token = sentToken || res.headers.get('X-Session');
    if (!token) {
        throw new Error(`What no response`);
    }
    const auth = { user, token };
    localStorage.setItem(storageKey, JSON.stringify(auth));
    listeners.forEach((fn) => fn(auth));
    return auth;
};

const getUser = async (host: string, token: string) => {
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
        throw new Error(`Not logged in`);
    }
    return processResponse(res, token);
};

const login = async (host, email, password) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(`${window.location.protocol}//${host}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return processResponse(res);
};

const signup = async (host, email, password, name, invite) => {
    // TODO figure out what the behavior is here if we're offline
    const res = await fetch(`${window.location.protocol}//${host}/api/signup`, {
        method: 'POST',
        body: JSON.stringify({ email, password, name, invite }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return processResponse(res);
};

const storageKey = `millder-card-sort-auth`;

type Data = { user: { id: string, info: { name: string, email: string } }, token: string };
type Status = false | null | Data;

const initialStatus = (): Status => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
        try {
            const { user, token } = JSON.parse(raw);
            if (!user || !token) {
                throw new Error(`Unexpected data`);
            }
            return { user, token };
        } catch {
            return false;
        }
    } else {
        return false;
    }
};

export const useAuthStatus = (host: string) => {
    const [status, setStatus] = React.useState(() => initialStatus());

    React.useEffect(() => {
        if (status) {
            getUser(host, status.token).then(
                // in case user info or token changed
                (data: Status) => (data ? setStatus(data) : undefined),
                // if we were logged out
                (err) => setStatus(false),
            );
        }
    }, [host]);

    React.useEffect(() => {
        const fn = (auth) => setStatus(auth);
        listeners.push(fn);
        return () => {
            const idx = listeners.indexOf(fn);
            if (idx !== -1) {
                listeners.splice(idx, 1);
            }
        };
    }, []);

    return status;
};

const Signup = ({ host }: { host: string }) => {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [invite, setInvite] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    return (
        <form
            onSubmit={(evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                if (email !== '' && password.trim() !== '') {
                    setLoading(true);
                    signup(host, email, password, name, invite).then(
                        (auth) => {
                            setLoading(false);
                        },
                        (err) => {
                            setLoading(err.message);
                        },
                    );
                }
            }}
        >
            <input
                value={name}
                disabled={loading === true}
                onChange={(evt) => setName(evt.target.value)}
                placeholder="Name"
            />
            <input
                value={email}
                disabled={loading === true}
                onChange={(evt) => setEmail(evt.target.value)}
                placeholder="Email Address"
            />
            <input
                value={password}
                disabled={loading === true}
                onChange={(evt) => setPassword(evt.target.value)}
                placeholder="Password"
                type="password"
            />
            <input
                value={invite}
                disabled={loading === true}
                onChange={(evt) => setInvite(evt.target.value)}
                placeholder="Invite Code"
            />
            <button disabled={loading === true}>Sign up</button>
            {typeof loading === 'string' ? <div>{loading}</div> : null}
        </form>
    );
};

const Login = ({ host }: { host: string }) => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    return (
        <form
            onSubmit={(evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                if (email !== '' && password.trim() !== '') {
                    setLoading(true);
                    login(host, email, password).then(
                        (auth) => {
                            setLoading(false);
                        },
                        (err) => {
                            setLoading(err.message);
                        },
                    );
                }
            }}
        >
            <input
                value={email}
                disabled={loading === true}
                onChange={(evt) => setEmail(evt.target.value)}
                placeholder="Email Address"
            />
            <input
                value={password}
                disabled={loading === true}
                onChange={(evt) => setPassword(evt.target.value)}
                placeholder="Password"
                type="password"
            />
            <button disabled={loading === true}>Login</button>
            {typeof loading === 'string' ? <div>{loading}</div> : null}
        </form>
    );
};

const Auth = ({ host }: { host: string }) => {
    // TODO do a server check to determine if we're allowing signup without invites
    return (
        <div>
            <h2>Log in</h2>
            <Login host={host} />
            <h2>Sign up</h2>
            <Signup host={host} />
        </div>
    );
};

export default Auth;
