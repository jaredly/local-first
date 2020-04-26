// @flow
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Cancel from '@material-ui/icons/Cancel';
import Folder from '@material-ui/icons/Folder';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Client, SyncStatus } from '../../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../../packages/client-react';
import type { AuthData } from '../App';
import AppShell from '../Shell/AppShell';
import { Item } from '../TodoList/Item';
import { type Day, type ItemT, newDay } from '../types';
import { nextDay, parseDate, prevDay, showDate } from '../utils';

const depthFirst = (
    data: { [key: string]: ItemT },
    rootId: string,
    filter: (ItemT) => boolean,
): Array<{ node: ItemT, path: Array<ItemT> }> => {
    console.log('depth from ', rootId);
    const root = data[rootId];
    if (!root) {
        console.log('no root');
        return [];
    }
    const items: Array<{ node: ItemT, path: Array<ItemT> }> = [];
    const next = [{ node: root, path: [] }];
    const seen = {};
    while (next.length) {
        const item = next.shift();
        const path = item.node.id === 'root' ? [] : item.path.concat(item.node);
        item.node.children.forEach((id) => {
            if (seen[id]) {
                return;
            }
            seen[id] = true;
            const child = data[id];
            if (child && filter(child)) {
                items.push({ node: child, path });
            }
            if (child && child.children.length) {
                next.push({ node: child, path });
            }
        });
    }
    return items;
};

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

// Hmm maybe best to show them hierarchically?
const FilterPicker = ({
    data,
    setFilter,
}: {
    data: { [key: string]: ItemT },
    setFilter: (false | ?string) => void,
}) => {
    const styles = useStyles();
    const items = React.useMemo(() => {
        return depthFirst(data, 'root', (item) => item.id !== 'root' && item.style === 'group');
    }, [data]);

    return (
        <div>
            <Button onClick={() => setFilter(false)}>Cancel</Button>
            {items.map(({ node, path }) => (
                <div
                    key={node.id}
                    onClick={() => setFilter(node.id)}
                    className={styles.item}
                    style={{
                        display: 'flex',
                    }}
                >
                    <Folder />
                    {node.title}
                    <div style={{ flex: 1 }} />
                    {interleave(
                        path.map((node) => <span key={node.id}>{node.title}</span>),
                        (i) => (
                            <div>&nbsp;&gt;&nbsp;</div>
                        ),
                    )}
                </div>
            ))}
        </div>
    );
};

const ItemPicker = ({
    client,
    onPick,
}: {
    client: Client<SyncStatus>,
    onPick: (?string) => void,
}) => {
    const [col, data] = useCollection(React, client, 'items');
    const [filter, setFilter] = React.useState(false);
    const styles = useStyles();

    const items = React.useMemo(() => {
        if (filter != null && filter !== false) {
            return depthFirst(
                data,
                filter,
                (item) => item.style !== 'group' && item.completedDate == null,
            ); //.map((m) => m.node);
        } else {
            return depthFirst(
                data,
                'root',
                (item) => item.style !== 'group' && item.completedDate == null,
            ).sort((a, b) => b.node.createdDate - a.node.createdDate);
            // return Object.keys(data)
            //     .filter((k) => data[k].completedDate == null && data[k].style !== 'group')
            //     .map((k) => data[k])
            //     .sort((a, b) => b.createdDate - a.createdDate);
        }
    }, [data, typeof filter === 'string' ? filter : null]);

    if (filter === null) {
        return <FilterPicker data={data} setFilter={setFilter} />;
    }
    return (
        <div>
            <Button onClick={() => onPick(null)}>Cancel</Button>
            <Button onClick={() => setFilter(null)}>Filter</Button>
            {items.map(({ node, path }) => (
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
            ))}
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
