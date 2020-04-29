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

const startHour = 3;
const endHour = 21;

const ScheduledItem = ({ client, item, divHeight }) => {
    const styles = useStyles();
    const [_, todo] =
        item.itemId != null ? useItem(React, client, 'items', item.itemId) : [null, null];
    return (
        <div
            className={styles.schedule}
            style={{
                height:
                    ((item.endTime - item.startTime) / 60 / (endHour + 1 - startHour)) * divHeight,
                top: ((item.startTime / 60 - startHour) / (endHour + 1 - startHour)) * divHeight,
            }}
        >
            {/* {item.itemId} */}
            {/* {item.startTime / 60} */}
            {todo != null && todo !== false ? todo.title : null}
        </div>
    );
};

const Hourly = ({
    col,
    day,
    onRef,
    client,
}: {
    col: Collection<Day>,
    day: Day,
    client: Client<SyncStatus>,
    onRef: (HTMLDivElement) => void,
}) => {
    const styles = useStyles();
    // oh, need to be able to configure start & end hours
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

    const [div, setDiv] = React.useState(null);
    const divHeight = div ? div.offsetHeight : 0;

    return (
        <div
            className={styles.hourly}
            ref={(node) => {
                if (node) {
                    onRef(node);
                }
                if (!div && node) {
                    setDiv(node);
                }
            }}
        >
            {slots}
            {div
                ? Object.keys(day.schedule).map((k) => (
                      <ScheduledItem
                          key={k}
                          divHeight={divHeight}
                          item={day.schedule[k]}
                          client={client}
                      />
                  ))
                : null}
        </div>
    );
};

const useStyles = makeStyles((theme) => ({
    schedule: {
        position: 'absolute',
        //   backgroundColor: 'rgba(255,255,255,0.1)',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(1),
        left: 50,
        right: 8,
    },
    hourly: {
        display: 'flex',
        position: 'relative',
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
