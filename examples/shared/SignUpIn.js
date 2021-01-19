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

export default SignUpIn;
