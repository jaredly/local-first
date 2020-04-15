// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import AppBar from '@material-ui/core/AppBar';
import Switch from '@material-ui/core/Switch';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
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

import type { Data } from './auth-api';

import LinkItem from './LinkItem';

const schemas = {
    tags: TagSchema,
    links: LinkSchema,
};

const App = ({
    host,
    auth,
    logout,
}: {
    host: string,
    auth: ?Data,
    logout: () => void,
}) => {
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

    const [showAll, setShowAll] = React.useState(false);
    const [numToShow, setNumToShow] = React.useState(20);

    // We want to show any links that, at first load of this screen,
    // were not collapsed.
    const [initiallyCompleted, setInitiallyCompleted] = React.useState(() => {
        const completed = {};
        Object.keys(links).forEach((k) => {
            if (links[k].completed) {
                completed[k] = true;
            }
        });
        return completed;
    });
    const lastLinks = React.useRef(links);

    React.useEffect(() => {
        console.log('links changed');
        const newCompleted = {};
        let hasNew = false;
        Object.keys(links).forEach((k) => {
            if (!lastLinks.current[k] && links[k].completed) {
                newCompleted[k] = true;
                hasNew = true;
            }
        });
        lastLinks.current = links;
        setInitiallyCompleted((state) => ({ ...state, ...newCompleted }));
    }, [links]);

    const styles = useStyles();

    let linksToShow = Object.keys(links)
        .filter((k) => (showAll ? true : !initiallyCompleted[k]))
        .sort((a, b) => links[b].added - links[a].added);

    const [anchorEl, setAnchorEl] = React.useState(null);

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

                    <Typography>Show completed</Typography>
                    <Switch
                        checked={showAll}
                        onChange={() => setShowAll(!showAll)}
                    />

                    <Button
                        color="inherit"
                        onClick={(evt) => setAnchorEl(evt.target)}
                        className={styles.userButton}
                    >
                        {auth ? auth.user.email : 'Login to sync'}
                    </Button>

                    <Menu
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={!!anchorEl}
                        onClose={() => setAnchorEl(null)}
                    >
                        <MenuItem
                            onClick={() => {
                                setAnchorEl(null);
                                logout();
                            }}
                        >
                            Log out
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                // setAnchorEl(null)
                            }}
                        >
                            Export Data
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                // setAnchorEl(null)
                            }}
                        >
                            Import Data
                        </MenuItem>
                    </Menu>
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
                            added: Date.now(),
                            tags: {},
                            description: null,
                            completed: null,
                        });
                    }}
                />
                <div style={{ height: 12 }} />
                {linksToShow.slice(0, numToShow).map((key, i) => (
                    <React.Fragment key={key}>
                        {i !== 0 ? <div style={{ height: 12 }} /> : null}
                        <LinkItem
                            linksCol={linksCol}
                            link={links[key]}
                            key={key}
                        />
                    </React.Fragment>
                ))}
                <div style={{ height: 12 }} />
                {linksToShow.length > numToShow ? (
                    <Button onClick={() => setNumToShow(numToShow + 20)}>
                        Show more
                    </Button>
                ) : null}
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
