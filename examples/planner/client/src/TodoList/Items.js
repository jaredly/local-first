// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useItem, useItems } from '../../../../../packages/client-react';
import { type DragInit } from './Item';
import { ItemChildren } from './ItemChildren';
import { newItem } from '../types';
import { useParams, useHistory } from 'react-router-dom';
import pako from 'pako';
import { interleave } from '../utils';

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
    dest: ?{
        id: string,
        path: Array<string>,
        position: 'top' | 'bottom' | 'first-child',
        idx: number,
    },
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
            const leftOffset = current.item.parent ? 32 : 0;
            return {
                started: true,
                dragging,
                dest: {
                    id: current.item.id,
                    path: current.item.path,
                    position: current.item.parent ? 'first-child' : 'bottom',
                    idx: current.item.idx + 1,
                },
                y: current.box.bottom - offset,
                left: current.box.left + leftOffset,
                width: current.box.width - leftOffset,
            };
        }
    }
};

const setupDragListeners = (dragRefs, currentDragger, setDragger, col) => {
    const positions = {};
    const boxes = Object.keys(dragRefs)
        .map((k) => ({ item: dragRefs[k], box: dragRefs[k].node.getBoundingClientRect() }))
        .sort((a, b) => a.box.top - b.box.top);
    const move = (evt) => {
        // console.log('ok', evt.clientY, evt);
        const { x, y } =
            evt.clientY == null
                ? evt.touches.length > 0
                    ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
                    : { x: 0, y: null }
                : { x: evt.clientX, y: evt.clientY };
        if (y == null) {
            return;
        }
        const current = currentDragger.current;
        if (!current) {
            return;
        }
        if (!current.started) {
            const pos = current.dragging.pos;
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist < 10) {
                return;
            }
        }
        if (current.dest == null) {
            current.dragging.onStart();
        }
        const position = getPosition(boxes, y, current.dragging);
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
            if (dest.position === 'first-child') {
                if (dest.id === oldPid) {
                    // dunno what to do here
                    // STOPSHIP
                } else {
                    col.removeId(oldPid, ['children'], dragging.id);
                    col.insertId(dest.id, ['children'], 0, dragging.id);
                }
            } else if (oldPid === newPid) {
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
    window.addEventListener('touchmove', move, true);
    window.addEventListener('touchend', up, true);
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    return () => {
        window.removeEventListener('touchmove', move, true);
        window.removeEventListener('touchend', up, true);
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('mouseup', up, true);
    };
};

const Items = ({ client, showAll }: { client: Client<SyncStatus>, showAll: boolean }) => {
    const { ids } = useParams();
    const styles = useStyles();
    const history = useHistory();

    const rootPath = React.useMemo(() => {
        if (!ids) {
            return ['root'];
        }
        const path = pako.inflate(atob(ids), { to: 'string' });
        if (path === '') {
            return ['root'];
        }
        return ['root'].concat(path.split('/'));
    }, [ids]);
    const setRootPath = React.useCallback((path) => {
        if (path.length === 1) {
            history.push('/');
        } else {
            const raw = btoa(pako.deflate(path.slice(1).join('/'), { to: 'string' }));
            history.push(`/item/${raw}`);
        }
    }, []);

    const [col, breadcrumbItems] = useItems(React, client, 'items', rootPath);

    const rootId = rootPath[rootPath.length - 1];
    const root = breadcrumbItems ? breadcrumbItems[rootId] : null;

    const [_, childItems] = useItems(React, client, 'items', root ? root.children : []);

    React.useEffect(() => {
        col.loadAll();
    }, []);

    const dragRefs = React.useMemo(() => ({}), []);

    const [dragger, setDragger] = React.useState(null);
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    React.useEffect(() => {
        if (dragger != null) {
            return setupDragListeners(dragRefs, currentDragger, setDragger, col);
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

    const show = React.useCallback(
        (item) => {
            return showAll || item.style === 'group' || item.completedDate == null;
        },
        [showAll],
    );

    if (!childItems) {
        // wait for the child items to load
        return null;
    }

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Button onClick={() => client.undo()}>Undo</Button>
            {dragger != null && dragger.y != null && dragger.dest != null ? (
                <div
                    className={styles.dragIndicator}
                    style={{
                        left: dragger.left,
                        width: dragger.width,
                        transform: `translateY(${dragger.y}px)`,
                        top: 0,
                    }}
                ></div>
            ) : null}
            {root ? (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                        {breadcrumbItems
                            ? interleave(
                                  rootPath
                                      .map((id) => breadcrumbItems[id])
                                      // .filter(Boolean)
                                      .map((item, i) =>
                                          item ? (
                                              <Button
                                                  key={item.id}
                                                  onClick={() =>
                                                      setRootPath(rootPath.slice(0, i + 1))
                                                  }
                                              >
                                                  {item.title}
                                              </Button>
                                          ) : null,
                                      )
                                      .filter(Boolean),
                                  (i) => ' • ',
                              )
                            : null}
                    </div>
                    <ItemChildren
                        setRootPath={setRootPath}
                        onNewFocus={() => {}}
                        path={rootPath}
                        items={childItems}
                        dragRefs={dragRefs}
                        onDragStart={onDragStart}
                        show={show}
                        level={-1}
                        item={root}
                        client={client}
                        col={col}
                    />
                </div>
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
