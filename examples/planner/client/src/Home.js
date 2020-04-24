// @flow
import Container from '@material-ui/core/Container';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import { useCollection } from '../../../../packages/client-react';
import type { Data } from './auth-api';
import Drawer from './Drawer';
import EditTagDialog from './EditTagDialog';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';
import Items from './Items';
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
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const [showAll, setShowAll] = React.useState(false);
    // const [numToShow, setNumToShow] = React.useState(20);
    const [dialog, setDialog] = React.useState(null);
    const [menu, setMenu] = React.useState(false);

    const [editTag, setEditTag] = React.useState(false);

    const styles = useStyles();

    return (
        <React.Fragment>
            <TopBar
                auth={auth}
                setDialog={setDialog}
                logout={logout}
                openMenu={() => setMenu(true)}
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
            <Container maxWidth="sm" className={styles.container}>
                <Items client={client} showAll={showAll} />
                {/* <div style={{ height: 12 }} /> */}
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
