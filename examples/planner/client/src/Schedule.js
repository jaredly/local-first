// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
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
import Cancel from '@material-ui/icons/Cancel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { type Client, type SyncStatus } from '../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../packages/client-react';
import type { Data } from './auth-api';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';
import TopBar from './TopBar';
import EditTagDialog from './EditTagDialog';
import Items from './TodoList/Items';
import { newDay, type ItemT, type Day } from './types';
import { useParams } from 'react-router-dom';
import { Item } from './TodoList/Item';
import { showDate, parseDate, nextDay, prevDay } from './utils';
import { Link } from 'react-router-dom';
import AppShell from './AppShell';

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

const ShowItem = ({ client, id, onClear }) => {
    const [col, item] = useItem(React, client, 'items', id);
    const styles = useStyles();

    if (!item) return 'loading or deleted';
    return (
        <div
            // onClick={onClick}
            className={styles.item}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <div style={{ flex: 1 }}>
                <Item
                    client={client}
                    item={item}
                    level={0}
                    showAll={true}
                    path={[]}
                    dragRefs={{}}
                    onDragStart={() => {}}
                    setRootPath={() => {}}
                    idx={0}
                />
            </div>
            <IconButton onClick={onClear}>
                <Cancel />
            </IconButton>
            {/* {item.title} */}
        </div>
    );
};

const depthFirst = (
    data: { [key: string]: ItemT },
    rootId: string,
    filter: (ItemT) => boolean,
): Array<{ node: ItemT, path: Array<ItemT> }> => {
    console.log('depth from ', rootId);
    const root = data[rootId];
    if (!root) {
        console.log('no root');
        return [];
    }
    const items: Array<{ node: ItemT, path: Array<ItemT> }> = [];
    const next = [{ node: root, path: [] }];
    const seen = {};
    while (next.length) {
        const item = next.shift();
        const path = item.node.id === 'root' ? [] : item.path.concat(item.node);
        item.node.children.forEach((id) => {
            if (seen[id]) {
                return;
            }
            seen[id] = true;
            const child = data[id];
            if (child && filter(child)) {
                items.push({ node: child, path });
            }
            if (child && child.children.length) {
                next.push({ node: child, path });
            }
        });
    }
    return items;
};

const interleave = (items, fn) => {
    const res = [];
    items.forEach((item, i) => {
        if (i > 0) {
            res.push(fn(i));
        }
        res.push(item);
    });
    return res;
};

// Hmm maybe best to show them hierarchically?
const FilterPicker = ({ data, setFilter }) => {
    const styles = useStyles();
    const items = React.useMemo(() => {
        return depthFirst(data, 'root', (item) => item.id !== 'root' && item.style === 'group');
    }, [data]);

    return (
        <div>
            <Button onClick={() => setFilter(false)}>Cancel</Button>
            {items.map(({ node, path }) => (
                <div
                    key={node.id}
                    onClick={() => setFilter(node.id)}
                    className={styles.item}
                    style={{
                        display: 'flex',
                    }}
                >
                    <Folder />
                    {node.title}
                    <div style={{ flex: 1 }} />
                    {interleave(
                        path.map((node) => <span key={node.id}>{node.title}</span>),
                        (i) => (
                            <div>&nbsp;&gt;&nbsp;</div>
                        ),
                    )}
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
        if (filter != null && filter !== false) {
            return depthFirst(
                data,
                filter,
                (item) => item.style !== 'group' && item.completedDate == null,
            ); //.map((m) => m.node);
        } else {
            return depthFirst(
                data,
                'root',
                (item) => item.style !== 'group' && item.completedDate == null,
            ).sort((a, b) => b.node.createdDate - a.node.createdDate);
            // return Object.keys(data)
            //     .filter((k) => data[k].completedDate == null && data[k].style !== 'group')
            //     .map((k) => data[k])
            //     .sort((a, b) => b.createdDate - a.createdDate);
        }
    }, [data, typeof filter === 'string' ? filter : null]);

    if (filter === null) {
        return <FilterPicker data={data} setFilter={setFilter} />;
    }
    return (
        <div>
            <Button onClick={() => onPick(null)}>Cancel</Button>
            <Button onClick={() => setFilter(null)}>Filter</Button>
            {items.map(({ node, path }) => (
                <div
                    key={node.id}
                    onClick={() => onPick(node.id)}
                    className={styles.item}
                    style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                    }}
                >
                    <div>{node.title}</div>
                    <div style={{ display: 'flex', fontSize: '80%' }} className={styles.breadcrumb}>
                        {interleave(
                            path.map((node) => <span key={node.id}>{node.title}</span>),
                            (i) => (
                                <div style={{ padding: '0 4px' }}>·</div>
                            ),
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const Schedule = ({ client, id }: { id: string, client: Client<SyncStatus> }) => {
    const [col, day] = useItem<Day, SyncStatus>(React, client, 'days', id);

    const [picking, setPicking] = React.useState(null);
    const styles = useStyles();

    const todayDate = parseDate(id);
    const yesterdayId = showDate(prevDay(todayDate));
    const tomorrowId = showDate(nextDay(todayDate));

    if (!day) {
        return (
            <div>
                <div className={styles.topLinks}>
                    <Link className={styles.link} to={`/day/${yesterdayId}`}>
                        {yesterdayId}
                    </Link>
                    <div className={styles.today}>{id}</div>
                    <Link className={styles.link} to={`/day/${tomorrowId}`}>
                        {tomorrowId}
                    </Link>
                </div>
                <Button
                    onClick={() => {
                        col.save(id, newDay(id));
                    }}
                >
                    Start scheduling
                </Button>
            </div>
        );
    }

    if (picking != null) {
        return (
            <ItemPicker
                client={client}
                onPick={(itemId) => {
                    if (itemId == null) {
                        return setPicking(null);
                    }
                    if (picking === 'one') {
                        col.setAttribute(id, ['toDoList', 'topTwo', 'one'], itemId);
                    } else if (picking === 'two') {
                        col.setAttribute(id, ['toDoList', 'topTwo', 'two'], itemId);
                    } else if (picking === 'other') {
                        col.insertId(
                            id,
                            ['toDoList', 'others'],
                            day.toDoList.others.length,
                            itemId,
                        );
                    }
                    setPicking(null);
                }}
            />
        );
    }

    return (
        <div>
            <div className={styles.topLinks}>
                <Link className={styles.link} to={`/day/${yesterdayId}`}>
                    {yesterdayId}
                </Link>
                <div className={styles.today}>{id}</div>
                <Link className={styles.link} to={`/day/${tomorrowId}`}>
                    {tomorrowId}
                </Link>
            </div>
            <h1>Top Two</h1>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {day.toDoList.topTwo.one != null ? (
                    <ShowItem
                        onClear={() => col.clearAttribute(id, ['toDoList', 'topTwo', 'one'])}
                        id={day.toDoList.topTwo.one}
                        client={client}
                    />
                ) : (
                    <Button onClick={() => setPicking('one')}>Select Top 1</Button>
                )}
                {day.toDoList.topTwo.two != null ? (
                    <ShowItem
                        onClear={() => col.clearAttribute(id, ['toDoList', 'topTwo', 'two'])}
                        id={day.toDoList.topTwo.two}
                        client={client}
                    />
                ) : (
                    <Button onClick={() => setPicking('two')}>Select Top 2</Button>
                )}
            </div>
            <h2>Other To Do</h2>
            <div>
                {day.toDoList.others.map((otherId) => (
                    <ShowItem
                        id={otherId}
                        key={otherId}
                        client={client}
                        onClear={() => {
                            col.removeId(id, ['toDoList', 'others'], otherId);
                        }}
                    />
                ))}
                <Button onClick={() => setPicking('other')}>Add Other Item</Button>
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
        <AppShell auth={auth} logout={logout} client={client} host={host} drawerItems={null}>
            <Schedule client={client} id={day} />
        </AppShell>
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
        // cursor: 'pointer',
        flex: 1,
        padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
        ...theme.typography.body1,
        fontWeight: 300,
        // margin: 5,
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
        minHeight: 34,
        // '&:hover': {
        //     backgroundColor: theme.palette.primary.dark,
        // },
    },
    breadcrumb: {
        color: theme.palette.text.disabled,
    },
    link: {
        color: theme.palette.text.secondary,
    },
    today: {
        fontWeight: 'bold',
        padding: theme.spacing(2),
    },
    topLinks: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
}));

export default ScheduleWrapper;
