// @flow

import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Switch from '@material-ui/core/Switch';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import * as React from 'react';
import type { Data } from './auth-api';

const MyDrawer = ({
    onClose,
    auth,
    open,
    setDialog,
    showAll,
    setShowAll,
    logout,
}: {
    open: boolean,
    setDialog: ('export' | 'import') => void,
    showAll: boolean,
    setShowAll: (boolean) => void,
    logout: () => mixed,
    auth: ?Data,
    onClose: () => void,
}) => {
    return (
        <Drawer anchor={'left'} open={open} onClose={onClose}>
            <List>
                {auth ? (
                    <ListItem>
                        <ListItemIcon>
                            <AccountCircle />
                        </ListItemIcon>
                        <ListItemText primary={auth.user.email} />
                    </ListItem>
                ) : (
                    <ListItem button>
                        <ListItemIcon>
                            <AccountCircle />
                        </ListItemIcon>
                        <ListItemText primary="Sign in" />
                    </ListItem>
                )}
                <Divider />
                <ListItem button onClick={() => setDialog('export')}>
                    <ListItemIcon>
                        <GetApp />
                    </ListItemIcon>
                    <ListItemText primary="Export" />
                </ListItem>
                <ListItem button onClick={() => setDialog('import')}>
                    <ListItemIcon>
                        <Publish />
                    </ListItemIcon>
                    <ListItemText primary="Import" />
                </ListItem>
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
                <Divider />
                <ListItem button onClick={logout}>
                    <ListItemIcon>
                        <ExitToApp />
                    </ListItemIcon>
                    <ListItemText primary="Sign out" />
                </ListItem>
            </List>
            <Divider />
        </Drawer>
    );
};

export default MyDrawer;
