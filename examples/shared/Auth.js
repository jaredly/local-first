// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import FormHelperText from '@material-ui/core/FormHelperText';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import FormControl from '@material-ui/core/FormControl';

import type { Data, Status } from './auth-api';
import { checkEmail, login, signup, logout, initialStatus, listen, getUser } from './auth-api';

import SignUpIn from './SignUpIn';

export type AuthData = {
    host: string,
    auth: Data,
    logout: () => mixed,
    onLogout: (() => void) => () => void,
};

const useStyles = makeStyles(theme => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    root: {
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden',
    },
    body: {
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
    },
    topBar: {
        padding: theme.spacing(2),
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
    },
}));

/*

on startup, do we have stored user/auth data?
-- (yes)
   is it expired?
   -- (yes)
      Show a login dialog with the email & host prefilled
      The user has the option here to "log out", clearing the auth data.
   -- (no)
      good to go!

-- (no)
   do we have stored idb data?
   -- (yes)
      we're in local-only mode, go forth and prosper
   -- (no)
      show a message!

Hello! Welcome to "Things to Share"!
This is a 'local-first' app, which means
that all of your data lives on your device,
and is fully usable offline.
You can choose to log in to a syncing server
in order to access your data on multiple
devices, but this is not required.
You can also start local-only, and then sign
in to a syncing server later.

[Proceed Local-only]

[Log in to a syncing server]

*/

export const useAuthStatus = (storageKey: string, host: string): Status => {
    const [status, setStatus] = React.useState<Status | false>(() => initialStatus(storageKey));
    const statusRef = React.useRef(status);
    statusRef.current = status;

    React.useEffect(() => {
        if (status) {
            getUser(storageKey, host, status.token).then(
                // in case user info or token changed
                (data: ?Status) => {
                    console.log('got a new status', data);
                    if (data && (!statusRef.current || data.token !== statusRef.current.token)) {
                        console.log('updating the status');
                        setStatus(data);
                    }
                },
                // if we were logged out
                err => setStatus(false),
            );
        }
    }, [host]);

    React.useEffect(() => {
        return listen(auth => {
            if (!deepEqual(status, auth)) {
                setStatus(auth);
            }
        });
    }, []);

    return status;
};

export const AuthContext = React.createContext<?AuthData>(null);

const Auth = ({
    storageKey,
    host,
    render,
    allowLoggedOut,
}: {
    storageKey: string,
    host: string,
    render: (authData: ?AuthData) => React.Node,
    allowLoggedOut?: boolean,
}) => {
    const status = useAuthStatus(storageKey, host);
    console.log('aith render?', status);
    // load auth
    const listeners = React.useMemo(() => [], []);
    const onLogout = React.useCallback(fn => {
        listeners.push(fn);
        return () => {
            const idx = listeners.indexOf(fn);
            if (idx !== -1) {
                listeners.splice(idx, 1);
            }
        };
    }, []);
    const doLogout = React.useCallback(() => {
        if (status === false || status == null) {
            return;
        }
        logout(storageKey, host, status.token);
        console.log('calling listeners', listeners);
        listeners.forEach(fn => fn());
    }, [storageKey, host, status]);

    const authData = React.useMemo(
        () => (!!status ? { host, auth: status, logout: doLogout, onLogout } : status),
        [host, status, doLogout, onLogout],
    );

    if (authData === false && !allowLoggedOut) {
        // TODO maybe make storageKey the same as host?
        return <SignUpIn storageKey={storageKey} host={host} />;
    }
    if (authData == null) {
        return <div />;
    }
    return (
        <AuthContext.Provider value={authData === false ? null : authData}>
            {render(authData === false ? null : authData)}
        </AuthContext.Provider>
    );
};

export default Auth;
