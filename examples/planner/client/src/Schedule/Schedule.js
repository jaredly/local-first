// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Folder from '@material-ui/icons/Folder';
import RadioButtonUnchecked from '@material-ui/icons/RadioButtonUnchecked';
import CheckCircle from '@material-ui/icons/CheckCircle';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlined from '@material-ui/icons/CheckBoxOutlineBlank';
import * as React from 'react';
import { Link, useParams, useRouteMatch } from 'react-router-dom';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { type Day, type ItemT, type HabitT, newDay } from '../types';
import { nextDay, parseDate, prevDay, showDate, today } from '../utils';
import ItemPicker from './HierarchicalItemPicker';
import ShowItem from './ShowItem';
import Hourly from './Hourly';

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

const ShowHabit = ({ client, id, completed, setCompleted }) => {
    const [col, habit] = useItem<HabitT, SyncStatus>(React, client, 'habits', id);
    if (habit === false) {
        return null; // loading
    }
    if (!habit) {
        return 'Habit not found';
    }
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
                onClick={() => {
                    setCompleted(completed == null ? Date.now() : null);
                }}
            >
                {completed == null ? <CheckBoxOutlined /> : <CheckBox />}
            </IconButton>
            {habit.title}
        </div>
    );
};

const HabitsPicker = ({
    client,
    onSelect,
    onCancel,
    initialSelected,
}: {
    client: Client<SyncStatus>,
    onSelect: (Array<string>) => mixed,
    onCancel: () => void,
    initialSelected: Array<string>,
}) => {
    const [col, habits] = useCollection(React, client, 'habits');
    const [selected, setSelected] = React.useState(() => {
        const res = {};
        initialSelected.forEach((k) => (res[k] = true));
        return res;
    });

    return (
        <div>
            {Object.keys(habits).map((k) => (
                <div key={k}>
                    <IconButton
                        onClick={() => {
                            if (selected[k]) {
                                setSelected((sel) => {
                                    const res = { ...sel };
                                    delete res[k];
                                    return res;
                                });
                            } else {
                                setSelected((sel) => ({ ...sel, [k]: true }));
                            }
                        }}
                    >
                        {selected[k] ? <CheckCircle /> : <RadioButtonUnchecked />}
                    </IconButton>
                    {habits[k].title}
                </div>
            ))}
            <Button onClick={() => onCancel()}>Cancel</Button>
            <Button onClick={() => onSelect(Object.keys(selected))}>Save</Button>
        </div>
    );
};

const days = 'Sun,Mon,Tue,Wed,Thu,Fri,Sat'.split(',');
const months = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');

const humanReadable = (date: Date) => {
    // const now = new Date();
    const todayDate = today();
    if (date.getTime() === todayDate.getTime()) {
        return 'Today';
    }
    const tomorrowDate = nextDay(todayDate);
    if (date.getTime() === tomorrowDate.getTime()) {
        return 'Tomorrow';
    }
    const yesterDate = prevDay(todayDate);
    if (date.getTime() === yesterDate.getTime()) {
        return 'Yesterday';
    }
    // return date.toLocaleDateString();
    // return date.toDateString();
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
    // console.log(date.getTime() - todayDate.getTime());
    // return showDate(date);
};

const NavBar = ({ id }: { id: string }) => {
    const match = useRouteMatch();
    const matchBase = match.url.split('/').slice(0, -1).join('/');
    const styles = useStyles();
    const currentDate = parseDate(id);
    const prevDate = prevDay(currentDate);
    const prevDayId = showDate(prevDate);
    const nextDate = nextDay(currentDate);
    const nextDayId = showDate(nextDate);

    return (
        <div className={styles.topLinks}>
            <Link className={styles.link} to={`${matchBase}/${prevDayId}`}>
                {humanReadable(prevDate)}
            </Link>
            <div className={styles.today}>{humanReadable(currentDate)}</div>
            <Link className={styles.link} to={`${matchBase}/${nextDayId}`}>
                {humanReadable(nextDate)}
            </Link>
        </div>
    );
};

import { type DragRefs, calculateDragTargets, type Dest } from './dragging';
import { setupDragListeners, type DragState } from '../TodoList/dragging';

export const Schedule = ({ client, id }: { id: string, client: Client<SyncStatus> }) => {
    const [col, day] = useItem<Day, SyncStatus>(React, client, 'days', id);
    const match = useRouteMatch();
    const matchBase = match.url.split('/').slice(0, -1).join('/');

    const [picking, setPicking] = React.useState(null);
    const styles = useStyles();

    const [dragger, setDragger] = React.useState((null: ?DragState<Dest>));
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    const refs: DragRefs = React.useMemo(
        () => ({ hourly: null, others: {}, topOne: null, topTwo: null }),
        [],
    );

    React.useEffect(() => {
        if (dragger != null) {
            return setupDragListeners(
                calculateDragTargets(refs, dragger.dragging),
                currentDragger,
                false,
                setDragger,
                (dragging, dest) => {
                    console.log('drop', dragging, dest);
                    // const oldPid = last(dragging.path);
                    // const newPid = last(dest.path);
                    // if (dest.position === 'first-child') {
                    //     if (dest.id === oldPid) {
                    //         // dunno what to do here
                    //         // STOPSHIP
                    //     } else {
                    //         col.removeId(oldPid, ['children'], dragging.id);
                    //         col.insertId(dest.id, ['children'], 0, dragging.id);
                    //     }
                    // } else if (oldPid === newPid) {
                    //     // console.log(dest);
                    //     col.reorderIdRelative(
                    //         newPid,
                    //         ['children'],
                    //         dragging.id,
                    //         dest.id,
                    //         dest.position === 'top',
                    //     );
                    // } else {
                    //     col.removeId(oldPid, ['children'], dragging.id);
                    //     console.log('inserting', newPid, dest.id, dest.idx, dragging.id);
                    //     col.insertId(newPid, ['children'], dest.idx, dragging.id);
                    // }
                },
            );
        }
    }, [!!dragger]);

    if (day === false) {
        return (
            <div>
                <NavBar id={id} />
            </div>
        );
    }

    if (day == null) {
        return (
            <div>
                <NavBar id={id} />
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

    if (picking === 'habits') {
        return (
            <HabitsPicker
                client={client}
                initialSelected={Object.keys(day.habits)}
                onSelect={(ids) => {
                    Object.keys(day.habits).forEach((k) => {
                        if (!ids.includes(k)) {
                            col.clearAttribute(id, ['habits', k]);
                        }
                    });
                    ids.forEach((newId) => {
                        if (day.habits[newId] == null) {
                            col.setAttribute(id, ['habits', newId], {
                                completed: null,
                                notes: null,
                            });
                        }
                    });
                    setPicking(null);
                }}
                onCancel={() => setPicking(null)}
            />
        );
    } else if (picking === 'other') {
        return (
            <ItemPicker
                client={client}
                initial={day.toDoList.others}
                onPick={(items) => {
                    if (items == null) {
                        return setPicking(null);
                    }
                    items.forEach((item) => {
                        if (!day.toDoList.others.includes(item)) {
                            col.insertId(day.id, ['toDoList', 'others'], 0, item);
                        }
                    });
                    day.toDoList.others.forEach((id) => {
                        if (!items.includes(id)) {
                            col.removeId(day.id, ['toDoList', 'others'], id);
                        }
                    });
                    setPicking(null);
                }}
            />
        );
    }

    return (
        <div style={{ display: 'flex' }}>
            <div style={{ flex: 1 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <h1>Habits / Recurring</h1>
                    <Button onClick={() => setPicking('habits')}>Select habits</Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {Object.keys(day.habits).map((k) => (
                        <ShowHabit
                            key={k}
                            id={k}
                            setCompleted={(completd) =>
                                col.setAttribute(id, ['habits', k, 'completed'], completd)
                            }
                            client={client}
                            completed={day.habits[k].completed}
                            notes={day.habits[k].notes}
                        />
                    ))}
                    {Object.keys(day.habits).length === 0 ? <h3>No habits selected</h3> : null}
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
                        'Drop something here'
                    )}
                    {day.toDoList.topTwo.two != null ? (
                        <ShowItem
                            onClear={() => col.clearAttribute(id, ['toDoList', 'topTwo', 'two'])}
                            id={day.toDoList.topTwo.two}
                            client={client}
                        />
                    ) : (
                        'Drop something here'
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
            <div style={{ flex: 1 }}>
                <h1>Schedule</h1>
                <Hourly
                    col={col}
                    day={day}
                    onRef={(hourly) => {
                        refs.hourly = hourly;
                    }}
                />
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
        <AppShell authData={authData} client={client} noContainer drawerItems={null}>
            <NavBar id={day} />
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
