// @flow
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Container from '@material-ui/core/Container';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Divider from '@material-ui/core/Divider';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Switch from '@material-ui/core/Switch';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import {
    type Client,
    type SyncStatus,
} from '../../../../packages/client-bundle';
import { useCollection } from '../../../../packages/client-react';
import Adder from './Adder';
import type { Data } from './auth-api';
import ExportDialog from './ExportDialog';
import { searchableFields } from './OpenGraph';
import ImportDialog from './ImportDialog';
import LinkItem from './LinkItem';
import TopBar from './TopBar';
import EditTagDialog from './EditTagDialog';

import Drawer from './Drawer';

const matches = (term, link) => {
    if (link.url.toLowerCase().includes(term)) {
        return true;
    }
    if (link.fetchedContent == null) {
        return false;
    }
    const fields = searchableFields(link.fetchedContent);
    for (let k of Object.keys(fields)) {
        if (fields[k] && fields[k].toLowerCase().includes(term)) {
            return true;
        }
    }
    return false;
};

const Searcher = ({ client, host, tags, linksCol, links }) => {
    const [numToShow, setNumToShow] = React.useState(20);
    const [searchTerm, setSearchTerm] = React.useState('');

    const lastLinks = React.useRef(links);

    const styles = useStyles();

    let lower = searchTerm.toLowerCase();
    const linksToShow =
        searchTerm.length <= 2
            ? []
            : Object.keys(links)
                  .filter((k) => matches(lower, links[k]))
                  .sort((a, b) => links[b].added - links[a].added);

    return (
        <Container maxWidth="sm" className={styles.container}>
            <TextField
                onChange={(evt) => setSearchTerm(evt.target.value)}
                value={searchTerm}
                placeholder="Search..."
                fullWidth
            />
            <div style={{ height: 12 }} />
            {linksToShow.slice(0, numToShow).map((key, i) => (
                <React.Fragment key={key}>
                    {i !== 0 ? <div style={{ height: 12 }} /> : null}
                    <LinkItem
                        tags={tags}
                        host={host}
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
            {`Showing ${Math.min(numToShow, linksToShow.length)} of ${
                linksToShow.length
            } (${Object.keys(links).length} total links)`}
        </Container>
    );
};

const UncompletedList = ({ client, host, showAll, tags, linksCol, links }) => {
    const [numToShow, setNumToShow] = React.useState(20);

    // We want to show any links that, at first load of this screen,
    // were not collapsed.
    const [initiallyCompleted, setInitiallyCompleted] = React.useState(() => {
        const completed = {};
        Object.keys(links).forEach((k) => {
            if (links[k].completed != null) {
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
            if (!lastLinks.current[k] && links[k].completed != null) {
                newCompleted[k] = true;
                hasNew = true;
            }
        });
        lastLinks.current = links;
        if (hasNew) {
            setInitiallyCompleted((state) => ({ ...state, ...newCompleted }));
        }
    }, [links]);

    const styles = useStyles();

    const linksToShow = Object.keys(links)
        .filter((k) => (showAll ? true : !initiallyCompleted[k]))
        .sort((a, b) => links[b].added - links[a].added);

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Adder
                host={host}
                tags={tags}
                onAdd={(url, fetchedContent, currentTags) => {
                    const id = client.getStamp();
                    const tags = {};
                    currentTags.forEach((k) => (tags[k] = true));
                    linksCol.save(id, {
                        id,
                        url,
                        fetchedContent,
                        added: Date.now(),
                        tags,
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
                        tags={tags}
                        host={host}
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
            {`Showing ${Math.min(numToShow, linksToShow.length)} of ${
                linksToShow.length
            } (${Object.keys(links).length} total links)`}
        </Container>
    );
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
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const [linksCol, links] = useCollection(React, client, 'links');
    const [showAll, setShowAll] = React.useState(false);
    const [dialog, setDialog] = React.useState(null);
    const [menu, setMenu] = React.useState(false);
    const [searching, setSearching] = React.useState(false);

    const [editTag, setEditTag] = React.useState(false);

    const styles = useStyles();

    return (
        <React.Fragment>
            <TopBar
                auth={auth}
                setDialog={setDialog}
                logout={logout}
                openMenu={() => setMenu(true)}
                client={client}
                onSearch={() => {
                    setSearching(!searching);
                }}
            />
            <Drawer
                onClose={() => setMenu(false)}
                open={menu}
                auth={auth}
                setDialog={setDialog}
                showAll={showAll}
                setShowAll={setShowAll}
                logout={logout}
                tags={tags}
                tagsCol={tagsCol}
                editTag={setEditTag}
            />
            {searching ? (
                <Searcher
                    tags={tags}
                    client={client}
                    host={host}
                    linksCol={linksCol}
                    links={links}
                />
            ) : (
                <UncompletedList
                    tags={tags}
                    client={client}
                    host={host}
                    showAll={showAll}
                    linksCol={linksCol}
                    links={links}
                />
            )}
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
            {editTag !== false ? (
                <EditTagDialog
                    client={client}
                    tagsCol={tagsCol}
                    tag={editTag}
                    onClose={() => setEditTag(false)}
                />
            ) : null}
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
        '& > span': {
            display: 'inline',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
        textTransform: 'none',
        minWidth: 0,
    },
}));

export default Home;
