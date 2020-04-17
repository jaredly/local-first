// @flow
import * as React from 'react';
import querystring from 'querystring';

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
    type Client,
    type SyncStatus,
} from '../../../../packages/client-bundle';
import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';

import { TagSchema, LinkSchema, type LinkT } from './types';

import Adder from './Adder';

import type { Data } from './auth-api';

import LinkItem from './LinkItem';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';

const schemas = {
    tags: TagSchema,
    links: LinkSchema,
};

// const ExportDialog = ({ onClose }) => {
//     return 'export';
//     return <SimpleDialog
//     selectedValue={selectedValue}
//     open={open}
//     onClose={handleClose}
//     />
// };

// const ImportDialog = ({ onClose }) => {
//     return 'import';
// };
const rx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
const fullRx = /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/gi;
const endRx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/gi;

const App = ({
    host,
    auth,
    logout,
}: {
    host: string,
    auth: ?Data,
    logout: () => mixed,
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

    const [addingUrl, setAddingUrl] = React.useState(() => {
        const params = querystring.parse(window.location.search.slice(1));
        // const params = window.location.search
        //     .slice(1)
        //     .split('&')
        //     .map((item) => item.split('='))
        //     .reduce(
        //         (col, [k, v]) => (
        //             (col[k] = v ? decodeURIComponent(v) : v), col
        //         ),
        //         {},
        //     );
        if (params.url) {
            return params.url;
        }
        if (params.text) {
            const endMatch = params.text.trim().match(endRx);
            if (endMatch) {
                return endMatch[0];
            }
            const lines = params.text.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine.match(fullRx)) {
                return lastLine;
            }
            const match = params.text.match(rx);
            if (match) {
                return match[0];
            }
        }
        return null;
    });

    const linksCol = React.useMemo(
        () => client.getCollection<LinkT>('links'),
        [],
    );

    if (addingUrl) {
        return (
            <div>
                <Adder
                    host={host}
                    initialUrl={addingUrl}
                    onCancel={() => {
                        window.history.replaceState(null, '', '/');
                        setAddingUrl(null);
                    }}
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
                        // Reset the URL
                        window.history.replaceState(null, '', '/');
                        setAddingUrl(null);
                    }}
                />
            </div>
        );
    }

    return <Home client={client} auth={auth} logout={logout} host={host} />;
};

const Home = ({
    client,
    logout,
    host,
    auth,
}: {
    client: Client<SyncStatus>,
    logout: () => mixed,
    host: string,
    auth: ?Data,
}) => {
    const [linksCol, links] = useCollection(React, client, 'links');
    const [showAll, setShowAll] = React.useState(false);
    const [numToShow, setNumToShow] = React.useState(20);
    const [dialog, setDialog] = React.useState(null);

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

    const [menuOpen, setMenuOpen] = React.useState(false);
    const anchorEl = React.useRef(null);

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
                        onClick={(evt) => setMenuOpen(true)}
                        ref={(node) => (anchorEl.current = node)}
                        className={styles.userButton}
                    >
                        {auth ? auth.user.email : 'Login to sync'}
                    </Button>

                    <Menu
                        anchorEl={anchorEl.current}
                        keepMounted
                        open={menuOpen}
                        onClose={() => setMenuOpen(false)}
                    >
                        <MenuItem
                            onClick={() => {
                                setMenuOpen(false);
                                logout();
                            }}
                        >
                            Log out
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setDialog('export');
                                setMenuOpen(false);
                            }}
                        >
                            Export Data
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setDialog('import');
                                setMenuOpen(false);
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
                {window.location.href}
            </Container>
            {/* {dialogNode} */}
            <ExportDialog
                open={dialog === 'export'}
                client={client}
                onClose={() => setDialog(null)}
            />
            <ImportDialog
                open={dialog === 'import'}
                client={client}
                onClose={() => setDialog(null)}
            />
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
