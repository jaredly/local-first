// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Divider from '@material-ui/core/Divider';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Switch from '@material-ui/core/Switch';
import AccountCircle from '@material-ui/icons/AccountCircle';
import Folder from '@material-ui/icons/Folder';
import ExitToApp from '@material-ui/icons/ExitToApp';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { type Client, type SyncStatus } from '../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../packages/client-react';
import type { Data } from './auth-api';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';
import TopBar from './TopBar';
import EditTagDialog from './EditTagDialog';
import Items from './Items';
import { newDay } from './types';
import { useParams } from 'react-router-dom';

/*

Ok how is this going to look?

Also maybe I want a "habits" screen?
Just for editing habits.

param=date we're planning about

(if no plan has been made, need to click a button to "start planning this day")

oooh ok folks, our "day" should have the ID is that is just the date.
THis means if you double-add, they'll fight. Unfortunately. One will win.

[Habits]
- habit
- habit
- habit
- habit

[To Do To Day]
topTwo
.... what's the UI for adding things?
---- autocomplete? Or just a raw list, sorted by ... priority list, and horizon?
> would be nice to be able to filter by "category" (toplevel folder?)
> so, filters: (autocomplete for a folder), (priority), (horizon)
> sort (date added) (...)

[Schedule]
9:00
10:00
11;00
12:00
1:00
2:00

(btw we'll need a 'settings' colleciton, so you can indicate when your day starts n stuff.)



*/

const ShowItem = ({ client, id, onClick }) => {
    const [col, item] = useItem(React, client, 'items', id);
    const styles = useStyles();

    if (!item) return 'loading or deleted';
    return (
        <div onClick={onClick} className={styles.item}>
            {item.title}
        </div>
    );
};

const depthFirst = (data, rootId, filter) => {
    console.log('depth from ', rootId);
    const root = data[rootId];
    const items = [];
    const next = [root];
    const seen = {};
    while (next.length) {
        const item = next.shift();
        item.children.forEach((id) => {
            if (seen[id]) {
                return;
            }
            seen[id] = true;
            const child = data[id];
            if (child && filter(child)) {
                items.push(child);
            }
            if (child && child.children.length) {
                next.push(child);
            }
        });
    }
    return items;
};

const FilterPicker = ({ data, setFilter }) => {
    const styles = useStyles();
    const items = React.useMemo(() => {
        // const root = data.root;
        // const items = [];
        // const next = [root];
        // const seen = {};
        // while (next.length) {
        //     const item = next.shift();
        //     if (item.id !== 'root') {
        //         items.push(item);
        //     }
        //     item.children.forEach((id) => {
        //         const child = data[id];
        //         if (child && child.children.length) {
        //             if (seen[id]) {
        //                 return;
        //             }
        //             seen[id] = true;
        //             next.push(child);
        //         }
        //     });
        // }
        // return items;
        return depthFirst(data, 'root', (item) => item.id !== 'root' && item.style === 'group');
    }, [data]);

    return (
        <div>
            <Button onClick={() => setFilter(false)}>Cancel</Button>
            {items.map((item) => (
                <div key={item.id} onClick={() => setFilter(item.id)} className={styles.item}>
                    <Folder />
                    {item.title}
                </div>
            ))}
        </div>
    );
};

const ItemPicker = ({ client, onPick }) => {
    const [col, data] = useCollection(React, client, 'items');
    const [filter, setFilter] = React.useState(false);
    const styles = useStyles();

    const items = React.useMemo(() => {
        if (filter) {
            return depthFirst(
                data,
                filter,
                (item) => item.style !== 'group' && item.completedDate == null,
            );
        } else {
            return Object.keys(data)
                .filter((k) => data[k].completedDate == null && data[k].style !== 'group')
                .map((k) => data[k])
                .sort((a, b) => b.createdDate - a.createdDate);
        }
    }, [data, !!filter ? filter : null]);

    if (filter === null) {
        return <FilterPicker data={data} setFilter={setFilter} />;
    }
    return (
        <div>
            <Button onClick={() => onPick(null)}>Cancel</Button>
            <Button onClick={() => setFilter(null)}>Filter</Button>
            {items.map((item) => (
                <div key={item.id} onClick={() => onPick(item.id)} className={styles.item}>
                    {item.title}
                </div>
            ))}
        </div>
    );
};

const Schedule = ({ client, id }: { id: string, client: Client<SyncStatus> }) => {
    const [col, day] = useItem(React, client, 'days', id);

    const [picking, setPicking] = React.useState(null);

    if (!day) {
        return (
            <button
                onClick={() => {
                    col.save(id, newDay(id));
                }}
            >
                Start scheduling
            </button>
        );
    }

    if (picking != null) {
        return (
            <ItemPicker
                client={client}
                onPick={(itemId) => {
                    if (!itemId) {
                        return setPicking(null);
                    }
                    if (picking === 'one') {
                        col.setAttribute(id, ['toDoList', 'topTwo', 'one'], itemId);
                    } else if (picking === 'two') {
                        col.setAttribute(id, ['toDoList', 'topTwo', 'two'], itemId);
                    } else {
                        // TODO general todo list
                    }
                    setPicking(null);
                }}
            />
        );
    }

    return (
        <div>
            <div>
                {day.toDoList.topTwo.one != null ? (
                    <ShowItem
                        onClick={() => setPicking('one')}
                        id={day.toDoList.topTwo.one}
                        client={client}
                    />
                ) : (
                    <button onClick={() => setPicking('one')}>Select Top 1</button>
                )}
                {day.toDoList.topTwo.two != null ? (
                    <ShowItem
                        onClick={() => setPicking('two')}
                        id={day.toDoList.topTwo.two}
                        client={client}
                    />
                ) : (
                    <button onClick={() => setPicking('two')}>Select Top 2</button>
                )}
            </div>
        </div>
    );
};

const ScheduleWrapper = ({
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
    const { day } = useParams();
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
            {/* <Drawer
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
            /> */}
            <Container maxWidth="sm" className={styles.container}>
                <Schedule client={client} id={day} />
            </Container>
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
    item: {
        cursor: 'pointer',
        flex: 1,
        padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
        ...theme.typography.body1,
        fontWeight: 300,
        // margin: 5,
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
        minHeight: 34,
        '&:hover': {
            backgroundColor: theme.palette.primary.dark,
        },
    },
}));

export default ScheduleWrapper;
