// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useItem, useItems } from '../../../../../packages/client-react';
import { ItemChildren } from './ItemChildren';
import { newItem } from '../types';
import { useParams, useHistory } from 'react-router-dom';
import pako from 'pako';
import { interleave } from '../utils';
import { type DragRefs } from './Item';
import { type DragInit, setupDragListeners, type DragState } from './dragging';

type Dest = {
    id: string,
    path: Array<string>,
    position: 'top' | 'bottom' | 'first-child',
    idx: number,
};

const calculateDragTargets = (dragRefs: DragRefs, current: DragInit) => {
    const targets = [];

    Object.keys(dragRefs).forEach((k) => {
        const item = dragRefs[k];
        if (k === current.id || item.path.includes(current.id)) {
            return;
        }
        const box = item.node.getBoundingClientRect();
        targets.push({
            // y: box.top,
            top: box.top,
            height: 0,
            left: box.left,
            width: box.width,
            offsetParent: item.node.offsetParent,
            contents: {
                id: item.id,
                path: item.path,
                position: 'top',
                idx: item.idx,
            },
        });
        if (item.parent) {
            const offset = 32;
            targets.push({
                // y: box.bottom,
                top: box.bottom,
                height: 0,
                left: box.left + offset,
                width: box.width - offset,
                offsetParent: item.node.offsetParent,
                contents: {
                    id: item.id,
                    path: item.path,
                    position: 'first-child',
                    idx: 0,
                },
            });
        } else {
            targets.push({
                // y: box.bottom,
                top: box.bottom,
                height: 0,
                left: box.left,
                width: box.width,
                offsetParent: item.node.offsetParent,
                contents: {
                    id: item.id,
                    path: item.path,
                    position: 'bottom',
                    idx: item.idx + 1,
                },
            });
        }
    });
    // .map((k) => ({ item: dragRefs[k], box: dragRefs[k].node.getBoundingClientRect() }))
    // .sort((a, b) => a.box.top - b.box.top);

    return targets.sort((a, b) => a.top - b.top);
};

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

    const onDragRef = React.useCallback((id, item) => {
        if (item) {
            dragRefs[id] = {
                id,
                path: item.path,
                idx: item.idx,
                parent: item.parent,
                node: item.node,
            };
        } else {
            delete dragRefs[id];
        }
    }, []);

    const [dragger, setDragger] = React.useState((null: ?DragState<Dest>));
    const currentDragger = React.useRef(dragger);
    currentDragger.current = dragger;

    React.useEffect(() => {
        if (dragger != null) {
            return setupDragListeners(
                calculateDragTargets(dragRefs, dragger.dragging),
                currentDragger,
                false,
                setDragger,
                (dragging, dest) => {
                    if (dest.id === dragging.id) {
                        return;
                    }
                    console.log('drop', dragging, dest);
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
                        console.log('inserting', newPid, dest.id, dest.idx, dragging.id);
                        col.insertId(newPid, ['children'], dest.idx, dragging.id);
                    }
                },
            );
        }
    }, [!!dragger]);

    const onDragStart = React.useCallback((config: DragInit) => {
        const item = dragRefs[config.id];
        if (!item) {
            return;
        }
        // const box = item.node.getBoundingClientRect();
        // const parent = item.node.offsetParent.getBoundingClientRect();
        setDragger({
            dragging: config,
            dest: null,
            started: false,
            dims: null,
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
            {dragger != null && dragger.dims != null && dragger.dest != null ? (
                <div
                    className={styles.dragIndicator}
                    style={{
                        left: dragger.dims.left,
                        width: dragger.dims.width,
                        transform: `translateY(${dragger.dims.top}px)`,
                        height: dragger.dims.height + 4,
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
                        onDragRef={onDragRef}
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
