// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import { useItem } from '../../../../packages/client-react';
import { ItemChildren } from './Item';
import { newItem } from './types';

const useStyles = makeStyles((theme) => ({
    container: {},
}));

const getPosition = (boxes, clientY, dragging) => {
    const offsetParent = boxes[0].item.node.offsetParent;
    const offset = offsetParent.getBoundingClientRect().top;
    const y = clientY; // + offset; // include offsetTop?
    for (let i = 0; i < boxes.length; i++) {
        const current = boxes[i];
        const mid = (current.box.top + current.box.bottom) / 2;
        if (y < mid) {
            return {
                dragging,
                dest: {
                    id: current.item.id,
                    pid: current.item.pid,
                    position: 'top',
                    idx: current.item.idx,
                },
                y: current.box.top - offset,
                left: current.box.left,
                width: current.box.width,
            };
        } else if (i >= boxes.length - 1 || y < boxes[i + 1].box.top) {
            return {
                dragging,
                dest: {
                    id: current.item.id,
                    pid: current.item.pid,
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

    const refs = React.useMemo(() => ({}), []);

    const [dragger, setDragger] = React.useState(null);
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    React.useEffect(() => {
        if (dragger != null) {
            console.log('initializing dragger');
            const positions = {};
            const boxes = Object.keys(refs)
                .map((k) => ({ item: refs[k], box: refs[k].node.getBoundingClientRect() }))
                .sort((a, b) => a.box.top - b.box.top);
            const move = (evt) => {
                const position = getPosition(boxes, evt.clientY, dragger.dragging);
                if (position) {
                    setDragger(position);
                }
                // for (let i = 0; i < boxes.length; i++) {
                //     if (boxes[i].box.bottom > evt.clientY) {
                //         if (boxes[i].box.top <= evt.clientY) {
                //             const parent = boxes[i].node.offsetParent.getBoundingClientRect();
                //             setDragger({ top: boxes[i].box.top - parent.top, id: boxes[i].id });
                //         }
                //         break;
                //     }
                // }
            };
            const up = (evt) => {
                const dragger = currentDragger.current;
                if (!dragger) {
                    return;
                }
                console.log('move to', dragger);
                // STOPSHIP do the move actually
                const { dragging, dest } = dragger;
                if (dragging.pid === dest.pid) {
                    col.reorderIdRelative(
                        dragging.pid,
                        ['children'],
                        dragging.idx,
                        dest.id,
                        dest.position === 'before',
                    );
                } else {
                    col.removeId(dragging.pid, ['children'], dragging.id);
                    col.insertId(dest.pid, ['children'], dest.idx, dragging.id);
                }
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

    const onDragStart = React.useCallback((id: string, pid: string, idx: number) => {
        const item = refs[id];
        if (!item) {
            return;
        }
        const box = item.node.getBoundingClientRect();
        const parent = item.node.offsetParent.getBoundingClientRect();
        setDragger({
            dragging: { id, pid, idx },
            dest: {
                position: 'top',
                pid,
                id,
                idx,
            },
            y: box.top - parent.top,
            left: box.left,
            width: box.width,
        });
    }, []);

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
            {dragger != null ? (
                <div
                    style={{
                        position: 'absolute',
                        left: dragger.left,
                        width: dragger.width,
                        top: dragger.y,
                        height: 5,
                        backgroundColor: 'red',
                        mouseEvents: 'none',
                    }}
                ></div>
            ) : null}
            {root ? (
                <ItemChildren
                    pid="root"
                    dragRefs={refs}
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
