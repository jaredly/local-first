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

import AppShell from './Shell/AppShell';
import { Schedule } from './Schedule/Schedule';

import { Route, Switch as RouteSwitch, useRouteMatch, useParams } from 'react-router-dom';
import type { AuthData } from './App';

const Split = ({ client, authData }: { client: Client<SyncStatus>, authData: ?AuthData }) => {
    const { day } = useParams();
    const [showAll, setShowAll] = React.useState(false);

    return (
        <AppShell noContainer authData={authData} client={client} drawerItems={null}>
            <div style={{ display: 'flex' }}>
                <div style={{ flex: 1 }}>
                    <Schedule client={client} id={day} />
                </div>
                <div style={{ flex: 1 }}>
                    <Items client={client} showAll={showAll} />
                </div>
            </div>
        </AppShell>
    );
};

export default Split;
