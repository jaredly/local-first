// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
    container: {
        // border: '1px solid red',
        paddingTop: theme.spacing(8),
        // backgroundColor: theme.palette.background.default,
    },
    root: {
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden',
    },
    body: {
        padding: theme.spacing(2),
    },
    topBar: {
        padding: theme.spacing(2),
        // backgroundColor: theme.palette.primary.light,
    },
}));

const SignUpIn = () => {
    const styles = useStyles();

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Paper className={styles.root}>
                <div className={styles.topBar}>
                    <Typography variant="h4">Login</Typography>
                </div>
                <form className={styles.body}>
                    <Grid container direction="column" spacing={2}>
                        <Grid item>
                            <TextField
                                type="email"
                                id="outlined-basic"
                                label="Email Address"
                                variant="outlined"
                                fullWidth
                            />
                        </Grid>
                        <Grid item direction="row" container spacing={2}>
                            <Grid item>
                                <Button color="primary" variant="contained">
                                    Login
                                </Button>
                            </Grid>
                            <Grid item>
                                <Button variant="contained">Cancel</Button>
                            </Grid>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Container>
    );
};

const Auth = ({ host, render }: { host: string, render: () => React.Node }) => {
    const state = 'logged-out';
    // load auth

    if (state === 'logged-out') {
        return <SignUpIn />;
    }
    return render();
};

export default Auth;
