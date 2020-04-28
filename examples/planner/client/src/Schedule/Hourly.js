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
import type { Client, SyncStatus, Collection } from '../../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { type Day, type ItemT, type HabitT, newDay } from '../types';
import { nextDay, parseDate, prevDay, showDate, today } from '../utils';
import ItemPicker from './ItemPicker';
import ShowItem from './ShowItem';

const ap = (hour) => (hour >= 12 ? 'pm' : 'am');

// const hourName = (hour) => {
//     if (hour < 12) {
//         return hour + 'am';
//     }
//     if (hour === 12) {
//         return '12pm';
//     }
//     return hour - 12 + 'pm';
// };

const Hourly = ({ col, day }: { col: Collection<Day>, day: Day }) => {
    const styles = useStyles();
    // oh, need to be able to configure start & end hours
    const startHour = 3;
    const endHour = 21;
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
        slots.push(
            <div className={styles.hour + (h === startHour ? ' ' + styles.top : '')} key={h}>
                {h > 12 ? h - 12 : h}
                <span style={{ fontSize: '80%' }}>{ap(h)}</span>
                <div className={styles.half}>&nbsp;</div>
            </div>,
        );
    }
    return <div className={styles.hourly}>{slots}</div>;
};

const useStyles = makeStyles((theme) => ({
    hourly: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        // maxWidth: 400,
    },
    top: {
        borderTop: '1px solid #ccc',
    },
    hour: {
        borderBottom: '1px solid #ccc',
        borderLeft: '1px solid #ccc',
        borderRight: '1px solid #ccc',
        padding: theme.spacing(1),
    },
    half: {
        borderTop: '1px dashed #aaa',
    },
}));

export default Hourly;
