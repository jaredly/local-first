// @flow
import Container from '@material-ui/core/Container';
import ListItem from '@material-ui/core/ListItem';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import type { Data } from './auth-api';
import Items from './TodoList/Items';

import AppShell from './AppShell';

import { Route, Switch as RouteSwitch, useRouteMatch } from 'react-router-dom';
import type { AuthData } from './App';

const Home = ({
    client,
    // logout,
    // host,
    // auth,
    authData,
}: {
    client: Client<SyncStatus>,
    // logout: () => mixed,
    // host: string,
    // auth: ?Data,
    authData: ?AuthData,
}) => {
    const [showAll, setShowAll] = React.useState(false);
    const [menu, setMenu] = React.useState(false);
    console.log(showAll);

    const styles = useStyles();

    const match = useRouteMatch();

    return (
        <AppShell
            drawerItems={
                <ListItem>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showAll}
                                onChange={() => setShowAll(!showAll)}
                                color="primary"
                            />
                        }
                        label="Show completed"
                    />
                </ListItem>
            }
            authData={authData}
            // auth={auth}
            // host={host}
            // logout={logout}
            client={client}
        >
            <RouteSwitch>
                <Route path={`${match.path == '/' ? '' : match.path}/item/:ids+`}>
                    <Items client={client} showAll={showAll} />
                </Route>
                <Route path={`${match.path == '/' ? '' : match.path}`}>
                    <Items client={client} showAll={showAll} />
                </Route>
            </RouteSwitch>
        </AppShell>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
}));

export default Home;
