// @flow
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Folder from '@material-ui/icons/Folder';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Collection, Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { type HabitT, type ItemT, newHabit } from '../types';
import { nextDay, parseDate, prevDay, showDate } from '../utils';

import HabitEditor from './HabitEditor';

const Habit = ({ habit, col }: { habit: HabitT, col: Collection<HabitT> }) => {
    const styles = useStyles();
    const [editing, setEditing] = React.useState(false);
    if (editing) {
        return (
            <HabitEditor
                title={habit.title}
                description={habit.description}
                goalFrequency={habit.goalFrequency}
                onSave={(title, description, goalFrequency) => {
                    if (title !== habit.title) {
                        col.setAttribute(habit.id, ['title'], title);
                    }
                    if (description !== habit.description) {
                        col.setAttribute(habit.id, ['description'], description);
                    }
                    if (goalFrequency !== habit.goalFrequency) {
                        col.setAttribute(habit.id, ['goalFrequency'], goalFrequency);
                    }
                    setEditing(false);
                }}
                onCancel={() => setEditing(false)}
            />
        );
    }
    return (
        <div className={styles.habit}>
            <div className={styles.habitTitle}>{habit.title}</div>
            <div className={styles.habitDescription}>{habit.description}</div>

            <div style={{ flex: 1 }} />
            {habit.goalFrequency != null ? (
                <div className={styles.habitGoal}>{habit.goalFrequency}x / week</div>
            ) : null}
            <Button onClick={() => setEditing(true)}>Edit</Button>
        </div>
    );
};

const Habits = ({ client }) => {
    const [col, habits] = useCollection(React, client, 'habits');
    const [adding, setAdding] = React.useState(false);

    return (
        <div>
            <Typography variant="h4">Habits</Typography>
            {Object.keys(habits).map((k) => (
                <Habit col={col} habit={habits[k]} key={k} />
            ))}
            {adding ? (
                <HabitEditor
                    title=""
                    description=""
                    goalFrequency={null}
                    onSave={(title, description, goalFrequency) => {
                        const id = client.getStamp();
                        col.save(id, newHabit(id, title, description, goalFrequency));
                        setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                />
            ) : (
                <Button onClick={() => setAdding(true)}>Add Habit</Button>
            )}
        </div>
    );
};

const HabitsWrapper = ({
    client,
    authData,
}: {
    client: Client<SyncStatus>,
    authData: ?AuthData,
}) => {
    return (
        <AppShell authData={authData} client={client} drawerItems={null}>
            <Habits client={client} />
        </AppShell>
    );
};

export default HabitsWrapper;

const useStyles = makeStyles((theme) => ({
    habit: {
        padding: theme.spacing(1),
        display: 'flex',
        alignItems: 'center',
    },
    habitTitle: {
        ...theme.typography.body1,
    },
    habitDescription: {
        ...theme.typography.body2,
        marginLeft: theme.spacing(1),
        color: theme.palette.text.secondary,
    },
}));
