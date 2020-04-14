// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import { makeStyles } from '@material-ui/core/styles';

import {
    createInMemoryDeltaClient,
    createPersistedDeltaClient,
    createPersistedBlobClient,
} from '../../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';

import { TagSchema, LinkSchema } from './types';

const schemas = {
    tags: TagSchema,
    links: LinkSchema,
};

const App = ({ host, auth }: { host: string, auth: ?Data }) => {
    const client = React.useMemo(() => {
        console.log('starting a client', auth);
        return auth
            ? createPersistedDeltaClient(
                  'things-to-share',
                  schemas,
                  `${
                      host.startsWith('localhost:') ? 'ws' : 'wss'
                  }://${host}/sync?token=${auth.token}`,
              )
            : createPersistedBlobClient(
                  'things-to-share-blob',
                  schemas,
                  null,
                  2,
              );
    }, [auth && auth.token]);

    const styles = useStyles();

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Button color="primary" variant="contained">
                Ok buttons
            </Button>
        </Container>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
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
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
    },
}));

export default App;
