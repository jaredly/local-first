// @flow
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
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

const HabitEditor = (props: {
    title: string,
    description: string,
    goalFrequency: ?number,
    onSave: (string, string, ?number) => void,
    onCancel: () => void,
}) => {
    const [title, setTitle] = React.useState(props.title);
    const [description, setDescription] = React.useState(props.description);
    const [goalFrequency, setGoalFrequency] = React.useState(props.goalFrequency);

    return (
        <div>
            <TextField
                placeholder="Title"
                label="Title"
                value={title}
                onChange={(evt) => setTitle(evt.target.value)}
                fullWidth
            />
            <TextField
                placeholder="Description"
                label="Description"
                value={description}
                onChange={(evt) => setDescription(evt.target.value)}
                fullWidth
            />
            <TextField
                placeholder="Goal Frequency"
                label="Goal Frequency (per week)"
                type="number"
                value={goalFrequency == null ? '' : goalFrequency}
                fullWidth
                onChange={(evt) =>
                    setGoalFrequency(evt.target.value.length ? +evt.target.value : null)
                }
            />
            <div>
                <Button onClick={() => props.onSave(title, description, goalFrequency)}>
                    Save
                </Button>
                <Button onClick={() => props.onCancel()}>Cancel</Button>
            </div>
        </div>
    );
};

export default HabitEditor;
