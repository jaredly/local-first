// @flow

import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import Button from '@material-ui/core/Button';
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
import type { Data } from '../../shared/auth-api';
// import type { ListItem } from './types';
import { type Client, type SyncStatus, type Collection } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
// import EditTagDialog from './EditTagDialog';
// import ExportDialog from './ExportDialog';
// import ImportDialog from './ImportDialog';
import { Route, Link } from 'react-router-dom';
import Switch from '@material-ui/core/Switch';
// import { showDate, today } from '../utils';
import type { AuthData } from '../../shared/Auth';
import type { TagT, RecipeT } from '../collections';

const MyDrawer = ({
    open,
    onClose,
    authData,
    client,
    // auth,
    // logout,
    pageItems,
    actorId,
}: {
    client: Client<*>,
    open: boolean,
    onClose: () => void,
    authData: ?AuthData,
    // logout: () => mixed,
    // auth: ?Data,
    pageItems: React.Node,
    actorId: string,
}) => {
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [recipesCol, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [dialog, setDialog] = React.useState(null);

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (recipes[id].trashedDate != null || !recipes[id].tags) return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
        });
    });

    const approvedTagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (
            recipes[id].trashedDate != null ||
            !recipes[id].tags ||
            recipes[id].statuses[actorId] !== 'approved'
        )
            return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            approvedTagCounts[tid] = (approvedTagCounts[tid] || 0) + 1;
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) =>
        approvedTagCounts[a] === approvedTagCounts[b]
            ? (tagCounts[b] || 0) - (tagCounts[a] || 0)
            : (approvedTagCounts[b] || 0) - (approvedTagCounts[a] || 0),
    );

    const tagsToShow = tagIds.slice(0, 5);

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
                    {pageItems}
                    <Divider />
                    <ListItem button component={Link} to="/">
                        <ListItemText primary="Home" />
                    </ListItem>
                    <Divider />
                    <ListItem button component={Link} to="/plans">
                        <ListItemText primary="Meal Plans" />
                    </ListItem>
                    <ListItem button component={Link} to="/queue">
                        <ListItemText primary="Recipe queue" />
                    </ListItem>
                    <Divider />
                    <ListItem button component={Link} to="/latest">
                        <ListItemText primary="All Recipes" />
                    </ListItem>
                    <Divider />
                    {tagsToShow.map((id) => (
                        <ListItem key={id} button component={Link} to={`/tag/${id}`}>
                            <ListItemText primary={tags[id].text} />
                        </ListItem>
                    ))}
                    <Divider />
                    <ListItem button component={Link} to="/ingredients">
                        <ListItemText primary="Manage Ingredients" />
                    </ListItem>
                    <Divider />
                    {window.location.hostname === 'localhost' ? (
                        <ListItem>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={window.localStorage.useLocalFoood === 'true'}
                                        onChange={() => {
                                            if (window.localStorage.useLocalFoood === 'true') {
                                                window.localStorage.useLocalFoood = 'false';
                                            } else {
                                                window.localStorage.useLocalFoood = 'true';
                                            }
                                            location.reload();
                                        }}
                                        color="primary"
                                    />
                                }
                                label="Use Local Foood"
                            />
                        </ListItem>
                    ) : null}
                    {/* {Object.keys(tags).map((k) => (
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
                    </ListItem> */}
                    <Divider />
                    {authData ? (
                        <ListItem button onClick={authData.logout}>
                            <ListItemIcon>
                                <ExitToApp />
                            </ListItemIcon>
                            <ListItemText primary="Sign out" />
                        </ListItem>
                    ) : null}
                    <ListItem component={Link} to="/debug">
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

export default MyDrawer;
