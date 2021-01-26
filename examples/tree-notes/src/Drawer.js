// @flow

import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Switch from '@material-ui/core/Switch';
import ListItemText from '@material-ui/core/ListItemText';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import Label from '@material-ui/icons/Label';
import LabelOutlined from '@material-ui/icons/LabelOutlined';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import * as React from 'react';
import type { Data } from '../../shared/auth-api';
// import type { ListItem } from './types';
import { type Client, type SyncStatus, type Collection } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
// import EditTagDialog from './EditTagDialog';
// import ExportDialog from './ExportDialog';
// import ImportDialog from './ImportDialog';
import { Route, Link, useParams } from 'react-router-dom';
// import { showDate, today } from '../utils';
import type { AuthData } from '../../shared/Auth';

const MyDrawer = ({
    open,
    onClose,
    authData,
    client,
    // auth,
    // logout,
    pageItems,
}: {
    client: Client<SyncStatus>,
    open: boolean,
    onClose: () => void,
    authData: ?AuthData,
    // logout: () => mixed,
    // auth: ?Data,
    pageItems: React.Node,
}) => {
    // const [tagsCol, tags] = useCollection(React, client, 'tags');
    // const [editTag, setEditTag] = React.useState(false);
    const [dialog, setDialog] = React.useState(null);
    const params = useParams();

    return (
        <React.Fragment>
            <Drawer anchor={'left'} open={open} onClose={onClose}>
                <List>
                    {authData ? (
                        <ListItem>
                            <ListItemIcon>
                                <AccountCircle />
                            </ListItemIcon>
                            <ListItemText primary={authData.auth.user.email} />
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
                    <ListItem button component={Link} to="/" onClick={() => onClose()}>
                        <ListItemText primary="Home" />
                    </ListItem>
                    <Divider />
                    {pageItems}
                    <Divider />
                    {window.location.hostname === 'localhost' ? (
                        <ListItem>
                            <LocalButtons />
                        </ListItem>
                    ) : null}
                    <Divider />
                    {authData ? (
                        <ListItem
                            button
                            onClick={() => {
                                authData.logout().then(() => window.location.reload());
                            }}
                        >
                            <ListItemIcon>
                                <ExitToApp />
                            </ListItemIcon>
                            <ListItemText primary="Sign out" />
                        </ListItem>
                    ) : null}
                    <ListItem
                        component={Link}
                        onClick={() => onClose()}
                        to={params.doc ? `/doc/${params.doc}/debug` : '/debug'}
                        style={{ color: 'inherit' }}
                    >
                        <ListItemText
                            primary={`Version: ${
                                process.env.VERSION != null
                                    ? process.env.VERSION.slice(0, 5)
                                    : 'dev'
                            }`}
                        />
                    </ListItem>
                </List>
                <Divider />
            </Drawer>
        </React.Fragment>
    );
};

const LocalButtons = () => {
    const current = window.localStorage.treeNotesLocal;
    return (
        <ButtonGroup>
            <Button
                variant={current === 'memory' ? 'contained' : 'text'}
                onClick={() => {
                    window.localStorage.treeNotesLocal = 'memory';
                    location.reload();
                }}
            >
                Memory
            </Button>
            <Button
                variant={current === 'local' ? 'contained' : 'text'}
                onClick={() => {
                    window.localStorage.treeNotesLocal = 'local';
                    location.reload();
                }}
            >
                Localhost
            </Button>
            <Button
                variant={current !== 'local' && current !== 'memory' ? 'contained' : 'text'}
                onClick={() => {
                    window.localStorage.treeNotesLocal = '';
                    location.reload();
                }}
            >
                Remote
            </Button>
        </ButtonGroup>
    );
};

export default MyDrawer;
