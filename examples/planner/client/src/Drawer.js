// @flow

import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import Label from '@material-ui/icons/Label';
import LabelOutlined from '@material-ui/icons/LabelOutlined';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import * as React from 'react';
import type { Data } from './auth-api';
import type { TagT } from './types';
import { type Client, type SyncStatus, type Collection } from '../../../../packages/client-bundle';
import { useCollection } from '../../../../packages/client-react';
import EditTagDialog from './EditTagDialog';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';
import { Switch, Route, Link } from 'react-router-dom';
import { showDate, today } from './utils';

const MyDrawer = ({
    auth,
    open,
    onClose,
    client,
    logout,
    pageItems,
}: {
    client: Client<SyncStatus>,
    open: boolean,
    onClose: () => void,
    logout: () => mixed,
    auth: ?Data,
    pageItems: React.Node,
}) => {
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const [editTag, setEditTag] = React.useState(false);
    const [dialog, setDialog] = React.useState(null);

    return (
        <React.Fragment>
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
                    {pageItems}
                    <Divider />
                    <ListItem>
                        <Link to="/">Home</Link>
                    </ListItem>
                    <ListItem>
                        <Link to={`/day/${showDate(today())}`}>Today's Schedule</Link>
                    </ListItem>
                    {/* <Switch>
                        <Route path={`/`} exact>
                        </Route>
                        <Route>
                            <ListItem>
                                <Link to="/">Home</Link>
                            </ListItem>
                        </Route>
                    </Switch> */}
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
                    <Divider />
                    {Object.keys(tags).map((k) => (
                        <ListItem button onClick={() => setEditTag(tags[k])} key={k}>
                            <ListItemIcon>
                                <Label />
                            </ListItemIcon>
                            <ListItemText primary={tags[k].title} />
                        </ListItem>
                    ))}
                    <ListItem button onClick={() => setEditTag(null)}>
                        <ListItemIcon>
                            <LabelOutlined />
                        </ListItemIcon>
                        <ListItemText primary="New Tag" />
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

export default MyDrawer;
