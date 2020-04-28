// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Folder from '@material-ui/icons/Folder';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useCollection, useItem, useItems } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { ItemChildren } from '../TodoList/ItemChildren';
import { type Day, type ItemT, newDay } from '../types';
import { nextDay, parseDate, prevDay, showDate } from '../utils';
// import {Item} from '../TodoList/Item'

const interleave = (items, fn) => {
    const res = [];
    items.forEach((item, i) => {
        if (i > 0) {
            res.push(fn(i));
        }
        res.push(item);
    });
    return res;
};

const ItemPicker = ({
    initial,
    client,
    onPick,
}: {
    initial: Array<string>,
    client: Client<SyncStatus>,
    onPick: (?Array<string>) => void,
}) => {
    // const [col, data] = useCollection(React, client, 'items');
    // const [filter, setFilter] = React.useState(false);
    const [picked, setPicked] = React.useState(() => {
        const res = {};
        initial.forEach((id) => (res[id] = true));
        return res;
    });
    const styles = useStyles();
    const [rootPath, setRootPath] = React.useState(['root']);

    const [col, breadcrumbItems] = useItems(React, client, 'items', rootPath);

    const rootId = rootPath[rootPath.length - 1];
    const root = breadcrumbItems ? breadcrumbItems[rootId] : null;

    const [_, childItems] = useItems(React, client, 'items', root ? root.children : []);

    const dragRefs = React.useMemo(() => ({}), []);
    const onDragStart = React.useCallback(() => {}, []);

    // const [selectionMap, setSelectionMap] =

    const selection = React.useMemo(() => {
        return {
            map: picked,
            set: (item: string, bool: boolean) => {
                setPicked((picked) => {
                    if (bool) {
                        return { ...picked, [item]: true };
                    } else {
                        const res = { ...picked };
                        delete res[item];
                        return res;
                    }
                });
            },
        };
    }, [picked]);

    const show = React.useCallback((item) => {
        return item.completedDate == null;
    }, []);

    if (!root || !childItems) {
        return null;
    }

    return (
        <div>
            <Button onClick={() => onPick(null)}>Cancel</Button>
            <Button onClick={() => onPick(Object.keys(picked))}>Pick</Button>

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
                                          onClick={() => setRootPath(rootPath.slice(0, i + 1))}
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
                selection={selection}
                level={-1}
                item={root}
                client={client}
                col={col}
            />
            {/* {items.map(({ node, path }) => (
                <div
                    key={node.id}
                    onClick={() => onPick(node.id)}
                    className={styles.item}
                    style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                    }}
                >
                    <div>{node.title}</div>
                    <div style={{ display: 'flex', fontSize: '80%' }} className={styles.breadcrumb}>
                        {interleave(
                            path.map((node) => <span key={node.id}>{node.title}</span>),
                            (i) => (
                                <div style={{ padding: '0 4px' }}>·</div>
                            ),
                        )}
                    </div>
                </div>
            ))} */}
        </div>
    );
};

export default ItemPicker;

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    title: {
        flexGrow: 1,
    },
    menuButton: {
        marginRight: theme.spacing(2),
    },
    root: {
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden',
    },
    body: {
        padding: theme.spacing(2),
    },
    topBar: {
        padding: theme.spacing(2),
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
    },
    userButton: {
        '& > span': {
            display: 'inline',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
        textTransform: 'none',
        minWidth: 0,
    },
    item: {
        // cursor: 'pointer',
        flex: 1,
        padding: `${theme.spacing(1)}px ${theme.spacing(2)}px`,
        ...theme.typography.body1,
        fontWeight: 300,
        // margin: 5,
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
        minHeight: 34,
        // '&:hover': {
        //     backgroundColor: theme.palette.primary.dark,
        // },
    },
    breadcrumb: {
        color: theme.palette.text.disabled,
    },
    link: {
        color: theme.palette.text.secondary,
    },
    today: {
        fontWeight: 'bold',
        padding: theme.spacing(2),
    },
    topLinks: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
}));
