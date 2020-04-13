// @flow
/** @jsx jsx */
import { jsx } from '@emotion/core';
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';

const SignUpIn = () => {
    return (
        <Container maxWidth="sm">
            <form>
                <Grid container direction="column" spacing={2}>
                    <Grid item>
                        <TextField
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
