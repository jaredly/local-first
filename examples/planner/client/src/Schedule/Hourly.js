// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Close from '@material-ui/icons/Close';
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
import { fade } from '@material-ui/core/styles';

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

const ScheduledItem = ({
    setStart,
    setDuration,
    client,
    item,
    div,
    dragging,
    setDragging,
    onRemove,
}) => {
    const divHeight = div ? div.offsetHeight : 0;
    const styles = useStyles();
    const [_, todo] =
        item.itemId != null ? useItem(React, client, 'items', item.itemId) : [null, null];

    const currentDragging = React.useRef(dragging);
    currentDragging.current = dragging;

    React.useEffect(() => {
        if (dragging && dragging.id === item.id) {
            if (dragging.type === 'move') {
                const move = (evt) => {
                    // $FlowFixMe
                    const offset = div.offsetParent.getBoundingClientRect().top;
                    // console.log('offset', offset, div, div.offsetParent);
                    const top = evt.clientY - div.offsetTop - offset;
                    const hour = (top / divHeight) * (endHour + 1 - startHour) + startHour;
                    const stock = Math.min(Math.max(startHour, parseInt(hour * 4) / 4), endHour);
                    setDragging({ id: item.id, top: stock, type: 'move' });
                };
                const up = (evt) => {
                    if (currentDragging.current && currentDragging.current.top != null) {
                        const { top } = currentDragging.current;
                        if (top * 60 !== item.startTime) {
                            setStart(top * 60);
                        }
                    }
                    // console.log(currentDragging.current);
                    setDragging(null);
                };
                window.addEventListener('mousemove', move, true);
                window.addEventListener('mouseup', up, true);
                return () => {
                    window.removeEventListener('mousemove', move, true);
                    window.removeEventListener('mouseup', up, true);
                };
            } else {
                const move = (evt) => {
                    // $FlowFixMe
                    const offset = div.offsetParent.getBoundingClientRect().top;
                    const top = evt.clientY - div.offsetTop - offset;
                    const hour = (top / divHeight) * (endHour + 1 - startHour) + startHour;
                    const stock = Math.min(Math.max(startHour, parseInt(hour * 4) / 4), endHour);
                    setDragging({
                        id: item.id,
                        top: Math.max(15, stock * 60 - item.startTime),
                        type: 'resize',
                    });
                };
                const up = (evt) => {
                    if (currentDragging.current && currentDragging.current.top != null) {
                        const { top } = currentDragging.current;
                        if (top !== item.duration) {
                            setDuration(top);
                        }
                    }
                    // console.log(currentDragging.current);
                    setDragging(null);
                };
                window.addEventListener('mousemove', move, true);
                window.addEventListener('mouseup', up, true);
                return () => {
                    window.removeEventListener('mousemove', move, true);
                    window.removeEventListener('mouseup', up, true);
                };
            }
        }
    }, [!!dragging]);

    const currentTop = ((item.startTime / 60 - startHour) / (endHour + 1 - startHour)) * divHeight;

    return (
        <div
            className={styles.schedule}
            onMouseDown={(evt) => {
                evt.preventDefault();
                // pos
                // if (evt.clientX < )
                setDragging({ id: item.id, top: null, type: 'move' });
            }}
            style={{
                height:
                    dragging &&
                    dragging.id === item.id &&
                    dragging.top != null &&
                    dragging.type === 'resize'
                        ? (dragging.top / 60 / (endHour + 1 - startHour)) * divHeight
                        : (Math.max(30, item.duration || 0) / 60 / (endHour + 1 - startHour)) *
                          divHeight,
                top:
                    (dragging &&
                    dragging.id === item.id &&
                    dragging.top != null &&
                    dragging.type === 'move'
                        ? ((dragging.top - startHour) / (endHour + 1 - startHour)) * divHeight
                        : currentTop) + 1,
            }}
        >
            {todo != null && todo !== false ? todo.title : null}
            <button
                className={styles.closeButton}
                onClick={() => {
                    onRemove();
                }}
            >
                <Close fontSize="inherit" />
            </button>
            <div
                style={{
                    position: 'absolute',
                    cursor: 'ns-resize',
                    bottom: 0,
                    height: 4,
                    left: 0,
                    right: 0,
                    // backgroundColor: 'red',
                }}
                onMouseDown={(evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    // pos
                    // if (evt.clientX < )
                    setDragging({ id: item.id, top: null, type: 'resize' });
                }}
            />
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

    const [dragging, setDragging] = React.useState(null);

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
                          onRemove={() => {
                              col.clearAttribute(day.id, ['schedule', k]);
                          }}
                          setStart={(start) =>
                              col.setAttribute(day.id, ['schedule', k, 'startTime'], start)
                          }
                          setDuration={(duration) =>
                              col.setAttribute(day.id, ['schedule', k, 'duration'], duration)
                          }
                          dragging={dragging}
                          setDragging={setDragging}
                          div={div}
                          //   divHeight={divHeight}
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
        cursor: 'move',
        position: 'absolute',
        backgroundColor: fade(theme.palette.background.paper, 0.8),
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
    closeButton: {
        margin: 0,
        padding: 8,
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
        cursor: 'pointer',
        border: 'none',
        '&:hover': {
            color: theme.palette.error.main,
        },
    },
}));

export default Hourly;
