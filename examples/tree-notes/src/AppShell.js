// @flow
import Container from '@material-ui/core/Container';
import ListItem from '@material-ui/core/ListItem';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
import type { Data } from './auth-api';
// import Drawer from './Drawer';
// import Items from '../TodoList/Items';
import TopBar from './TopBar';

import { Route, Switch, useRouteMatch } from 'react-router-dom';
import type { AuthData } from './App';

const AppShell = ({
    client,
    // logout,
    // host,
    // auth,
    authData,
    drawerItems,
    children,
    noContainer,
}: {
    client: Client<SyncStatus>,
    // logout: () => mixed,
    // host: string,
    // auth: ?Data,
    authData: ?AuthData,
    children: React.Node,
    drawerItems: React.Node,
    noContainer?: boolean,
}) => {
    const [menu, setMenu] = React.useState(false);
    const styles = useStyles();
    const match = useRouteMatch();

    return (
        <React.Fragment>
            <TopBar openMenu={() => setMenu(true)} client={client} />
            {/* <Drawer
                pageItems={drawerItems}
                onClose={() => setMenu(false)}
                open={menu}
                authData={authData}
                client={client}
            /> */}
            <Container maxWidth={noContainer ? undefined : 'sm'} className={styles.container}>
                {children}
            </Container>
        </React.Fragment>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
}));

export default AppShell;
