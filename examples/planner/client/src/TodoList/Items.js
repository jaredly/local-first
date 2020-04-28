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
import { type DragInit } from './Item';
import { setupDragListeners, type DragState } from './dragging';

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

    const [dragger, setDragger] = React.useState((null: ?DragState));
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
            y: null,
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
