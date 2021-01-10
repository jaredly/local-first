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

const getDefaultValues = () => {
    const params = new URLSearchParams(location.search);
    if (params.get('invite')) {
        return { invite: params.get('invite') };
    }
    return {};
};

const SignUpIn = ({ storageKey, host }: { storageKey: string, host: string }) => {
    const styles = useStyles();

    const defaultValues = getDefaultValues();

    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [name, setName] = React.useState('');
    const [inviteCode, setInviteCode] = React.useState(defaultValues.invite);

    const [state, setState] = React.useState(defaultValues.invite != null ? 'register' : 'initial');
    const [loading, setLoading] = React.useState(false);
    const [inviteRequired, setInviteRequired] = React.useState(defaultValues.invite != null);

    const [error, setError] = React.useState(null);

    const checkUsername = () => {
        if (!email.length) {
            return;
        }
        setLoading(true);
        setError(null);
        checkEmail(host, email)
            .then(
                isRegistered => {
                    if (isRegistered === true) {
                        setState('login');
                    } else {
                        console.log(isRegistered);
                        if (isRegistered.inviteRequired) {
                            setInviteRequired(true);
                        }
                        setState('register');
                    }
                    // setState(isRegistered ? 'login' : 'register');
                },
                // um handle failure
                err => {
                    setError(err.message);
                },
            )
            .then(() => setLoading(false));
    };
    const doLogin = () => {
        setLoading(true);
        setError(null);
        if (!password.length || !email.length) {
            return;
        }
        login(storageKey, host, email, password).then(
            () => {
                // setLoading(false);
                // Someone should notice that we've logged in at this point
            },
            err => {
                setLoading(false);
                setError(err.message);
            },
        );
    };
    const doSignup = () => {
        setLoading(true);
        setError(null);
        signup(storageKey, host, email, password, name, inviteCode).then(
            () => {
                // setLoading(false);
                // Someone should notice that we've logged in at this point
            },
            err => {
                setError(err.message);
                setLoading(false);
            },
        );
    };

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Paper className={styles.root}>
                <div className={styles.topBar}>
                    <Typography variant="h4">
                        {state === 'register' ? 'Register' : 'Login'} to {host}
                    </Typography>
                </div>
                <form
                    className={styles.body}
                    onSubmit={evt => {
                        console.log('on submit', state);
                        evt.preventDefault();
                        if (state === 'initial') {
                            checkUsername();
                        } else if (state === 'login') {
                            doLogin();
                        } else if (state === 'register') {
                            doSignup();
                        }
                    }}
                >
                    <FormControl component="fieldset" error={error}>
                        <Grid container direction="column" spacing={2}>
                            <Grid item>
                                <TextField
                                    value={email}
                                    onChange={evt => setEmail(evt.target.value)}
                                    type="email"
                                    label="Email Address"
                                    variant="outlined"
                                    autoFocus={state === 'initial'}
                                    fullWidth
                                    disabled={loading}
                                />
                            </Grid>
                            {state === 'register' ? (
                                <Grid item>
                                    <TextField
                                        value={name}
                                        onChange={evt => setName(evt.target.value)}
                                        autoFocus
                                        type="text"
                                        label="Display Name"
                                        variant="outlined"
                                        fullWidth
                                        disabled={loading}
                                    />
                                </Grid>
                            ) : null}
                            {state === 'register' && inviteRequired ? (
                                <Grid item>
                                    <TextField
                                        value={inviteCode}
                                        onChange={evt => setInviteCode(evt.target.value)}
                                        autoFocus
                                        type="text"
                                        label="Invite code"
                                        variant="outlined"
                                        fullWidth
                                        disabled={loading}
                                    />
                                </Grid>
                            ) : null}
                            {state !== 'initial' ? (
                                <Grid item>
                                    <TextField
                                        value={password}
                                        onChange={evt => setPassword(evt.target.value)}
                                        type="password"
                                        // autoFocus={state === 'login'}
                                        label={
                                            state === 'register' ? 'Create password' : 'Password'
                                        }
                                        autoFocus
                                        variant="outlined"
                                        fullWidth
                                        disabled={loading}
                                        inputProps={{
                                            onKeyPress: evt => {
                                                if (evt.key === 'Enter') {
                                                    evt.preventDefault();
                                                    evt.stopPropagation();
                                                    doLogin();
                                                }
                                            },
                                        }}
                                    />
                                </Grid>
                            ) : null}
                            {state === 'initial' ? (
                                <Grid item>
                                    <Button
                                        color="primary"
                                        variant="contained"
                                        disabled={loading || !email.trim()}
                                        onClick={() => {
                                            checkUsername();
                                        }}
                                    >
                                        Continue
                                    </Button>
                                </Grid>
                            ) : null}
                            {state === 'login' ? (
                                <Grid item direction="row" container spacing={2}>
                                    <Grid item>
                                        <Button
                                            color="primary"
                                            variant="contained"
                                            disabled={loading}
                                            onClick={() => {
                                                doLogin();
                                            }}
                                        >
                                            Login
                                        </Button>
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            variant="contained"
                                            disabled={loading}
                                            onClick={() => {
                                                setState('initial');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </Grid>
                                </Grid>
                            ) : null}
                            <FormHelperText>{error}</FormHelperText>
                            {state === 'register' ? (
                                <Grid item direction="row" container spacing={2}>
                                    <Grid item>
                                        <Button
                                            color="primary"
                                            variant="contained"
                                            disabled={loading || !password.trim() || !name.trim()}
                                            onClick={() => {
                                                doSignup();
                                            }}
                                        >
                                            Register
                                        </Button>
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            variant="contained"
                                            disabled={loading}
                                            onClick={() => {
                                                setState('initial');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </Grid>
                                </Grid>
                            ) : null}
                        </Grid>
                    </FormControl>
                </form>
            </Paper>
        </Container>
    );
};

export const useAuthStatus = (storageKey: string, host: string) => {
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

const Auth = ({
    storageKey,
    host,
    render,
}: {
    storageKey: string,
    host: string,
    render: (authData: AuthData) => React.Node,
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

    if (status === false) {
        return <SignUpIn storageKey={storageKey} host={host} />;
    }
    if (status == null) {
        return <div />;
    }
    return render({ host, auth: status, logout: doLogout, onLogout });
};

export default Auth;
