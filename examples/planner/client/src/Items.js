// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import { useItem } from '../../../../packages/client-react';
import { ItemChildren, type DragInit } from './Item';
import { newItem } from './types';

const useStyles = makeStyles((theme) => ({
    container: {},
    dragIndicator: {
        position: 'absolute',
        height: 4,
        marginTop: -2,
        backgroundColor: theme.palette.primary.dark,
        mouseEvents: 'none',
        transition: `transform ease .1s`,
    },
}));

const last = (arr) => arr[arr.length - 1];

type DragState = {
    started: boolean,
    dragging: DragInit,
    dest: ?{ id: string, path: Array<string>, position: 'top' | 'bottom', idx: number },
    y: number,
    left: number,
    width: number,
};

const getPosition = (boxes, clientY, dragging): ?DragState => {
    const offsetParent = boxes[0].item.node.offsetParent;
    const offset = offsetParent.getBoundingClientRect().top;
    const y = clientY; // + offset; // include offsetTop?
    for (let i = 0; i < boxes.length; i++) {
        const current = boxes[i];
        const mid = (current.box.top + current.box.bottom) / 2;
        if (y < mid) {
            return {
                started: true,
                dragging,
                dest: {
                    id: current.item.id,
                    path: current.item.path,
                    position: 'top',
                    idx: current.item.idx,
                },
                y: current.box.top - offset,
                left: current.box.left,
                width: current.box.width,
            };
        } else if (i >= boxes.length - 1 || y < boxes[i + 1].box.top) {
            return {
                started: true,
                dragging,
                dest: {
                    id: current.item.id,
                    path: current.item.path,
                    position: 'bottom',
                    idx: current.item.idx + 1,
                },
                y: current.box.bottom - offset,
                left: current.box.left,
                width: current.box.width,
            };
        }
        // "if we've gotten this far, and the top is "
    }
};

const Items = ({ client }: { client: Client<SyncStatus> }) => {
    const styles = useStyles();

    const [col, root] = useItem(React, client, 'items', 'root');
    const [showAll, setShowAll] = React.useState(false);

    React.useEffect(() => {
        col.loadAll();
    }, []);

    const dragRefs = React.useMemo(() => ({}), []);

    const [dragger, setDragger] = React.useState(null);
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    React.useEffect(() => {
        if (dragger != null) {
            console.log('initializing dragger');
            const positions = {};
            const boxes = Object.keys(dragRefs)
                .map((k) => ({ item: dragRefs[k], box: dragRefs[k].node.getBoundingClientRect() }))
                .sort((a, b) => a.box.top - b.box.top);
            const move = (evt) => {
                if (currentDragger.current && !currentDragger.current.started) {
                    const pos = currentDragger.current.dragging.pos;
                    const dist = Math.sqrt(
                        Math.pow(evt.clientX - pos.x, 2) + Math.pow(evt.clientY - pos.y, 2),
                    );
                    if (dist < 10) {
                        return;
                    }
                }
                if (currentDragger.current && currentDragger.current.dest == null) {
                    currentDragger.current.dragging.onStart();
                }
                const position = getPosition(boxes, evt.clientY, dragger.dragging);
                if (position) {
                    if (
                        position.dest &&
                        (position.dest.id === position.dragging.id ||
                            position.dest.path.includes(position.dragging.id))
                    ) {
                        position.dest = null;
                    }
                    setDragger(position);
                }
            };
            const up = (evt) => {
                const dragger = currentDragger.current;
                if (!dragger) {
                    return;
                }
                // console.log('move to', dragger);
                // ok instead of PID, need to use the whole
                // path, so we don't make loops.
                // STOPSHIP do the move actually
                const { dragging, dest } = dragger;
                if (dest && dest.id !== dragging.id) {
                    const oldPid = last(dragging.path);
                    const newPid = last(dest.path);
                    if (oldPid === newPid) {
                        // console.log(dest);
                        col.reorderIdRelative(
                            newPid,
                            ['children'],
                            dragging.id,
                            dest.id,
                            dest.position === 'top',
                        );
                    } else {
                        col.removeId(oldPid, ['children'], dragging.id);
                        col.insertId(newPid, ['children'], dest.idx, dragging.id);
                    }
                }
                dragging.onFinish();
                setDragger(null);
            };
            window.addEventListener('mousemove', move, true);
            window.addEventListener('mouseup', up, true);
            return () => {
                window.removeEventListener('mousemove', move, true);
                window.removeEventListener('mouseup', up, true);
            };
        }
    }, [!!dragger]);

    const onDragStart = React.useCallback((config: DragInit) => {
        const item = dragRefs[config.id];
        if (!item) {
            return;
        }
        const box = item.node.getBoundingClientRect();
        const parent = item.node.offsetParent.getBoundingClientRect();
        setDragger({
            dragging: config,
            dest: null,
            started: false,
            left: box.left,
            width: box.width,
        });
    }, []);

    const path = React.useMemo(() => ['root'], []);

    return (
        <Container maxWidth="sm" className={styles.container}>
            <FormControlLabel
                control={
                    <Switch
                        checked={showAll}
                        onChange={() => setShowAll(!showAll)}
                        color="primary"
                    />
                }
                label="Show completed"
            />
            <Button onClick={() => client.undo()}>Undo</Button>
            {dragger != null && dragger.y != null && dragger.dest != null ? (
                <div
                    className={styles.dragIndicator}
                    style={{
                        left: dragger.left,
                        width: dragger.width,
                        transform: `translateY(${dragger.y}px)`,
                        top: 0,
                        // top: dragger.y,
                    }}
                ></div>
            ) : null}
            {root ? (
                <ItemChildren
                    path={path}
                    dragRefs={dragRefs}
                    onDragStart={onDragStart}
                    showAll={showAll}
                    level={-1}
                    item={root}
                    client={client}
                    col={col}
                />
            ) : (
                <div className={styles.empty}>
                    Hello! Let's get you started.
                    <Button
                        onClick={() => {
                            col.save('root', { ...newItem('root', 'Planner'), style: 'group' });
                        }}
                    >
                        Start this off
                    </Button>
                </div>
            )}
        </Container>
    );
};

export default Items;
