// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';

import { makeStyles } from '@material-ui/core/styles';

import { useCollection } from '../../../../packages/client-react';
import {
    createInMemoryDeltaClient,
    createPersistedDeltaClient,
    createPersistedBlobClient,
} from '../../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';

import { TagSchema, LinkSchema } from './types';

import Adder from './Adder';

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
    const [linksCol, links] = useCollection(React, client, 'links');

    const styles = useStyles();

    return (
        <React.Fragment>
            <AppBar position="sticky">
                <Toolbar>
                    <IconButton
                        edge="start"
                        className={styles.menuButton}
                        color="inherit"
                        aria-label="menu"
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" className={styles.title}>
                        Things to Share
                    </Typography>
                    <Button color="inherit" className={styles.userButton}>
                        {auth ? auth.user.email : 'Login to sync'}
                    </Button>
                </Toolbar>
            </AppBar>
            <Container maxWidth="sm" className={styles.container}>
                <Adder
                    host={host}
                    onAdd={(url, fetchedContent) => {
                        const id = client.getStamp();
                        linksCol.save(id, {
                            id,
                            url,
                            fetchedContent,
                            tags: {},
                            description: null,
                            completed: null,
                        });
                    }}
                />
            </Container>
        </React.Fragment>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    title: {
        flexGrow: 1,
    },
    menuButton: {
        marginRight: theme.spacing(2),
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
    userButton: {
        textTransform: 'none',
    },
}));

export default App;
