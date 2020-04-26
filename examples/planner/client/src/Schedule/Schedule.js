// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Folder from '@material-ui/icons/Folder';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { type Day, type ItemT, newDay } from '../types';
import { nextDay, parseDate, prevDay, showDate } from '../utils';
import ItemPicker from './ItemPicker';
import ShowItem from './ShowItem';

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
    authData,
}: {
    client: Client<SyncStatus>,
    authData: ?AuthData,
}) => {
    const { day } = useParams();

    return (
        <AppShell authData={authData} client={client} drawerItems={null}>
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
