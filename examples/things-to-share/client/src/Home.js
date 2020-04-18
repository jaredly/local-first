// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
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
import ImportDialog from './ImportDialog';
import LinkItem from './LinkItem';
import TopBar from './TopBar';

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
    // const [showAll, setShowAll] = React.useState(false);
    const [numToShow, setNumToShow] = React.useState(20);
    const [dialog, setDialog] = React.useState(null);

    const showAll = false;

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
        if (hasNew) {
            setInitiallyCompleted((state) => ({ ...state, ...newCompleted }));
        }
    }, [links]);

    const styles = useStyles();

    let linksToShow = Object.keys(links)
        .filter((k) => (showAll ? true : !initiallyCompleted[k]))
        .sort((a, b) => links[b].added - links[a].added);

    return (
        <React.Fragment>
            <TopBar auth={auth} setDialog={setDialog} logout={logout} />
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
