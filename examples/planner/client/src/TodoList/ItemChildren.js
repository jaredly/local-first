// @flow
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { newItem, type ItemT } from '../types';
import NewItem from './NewItem';
import type { Client, Collection, SyncStatus } from '../../../../../packages/client-bundle';

const INDENT = 24;

import type { DragRefs, DragInit } from './Item';
import { Item } from './Item';

export const ItemChildren = ({
    item,
    level,
    client,
    items,
    col,
    showAll,
    path,
    dragRefs,
    onDragStart,
    onNewFocus,
    setRootPath,
}: {|
    item: ItemT,
    level: number,
    items: { [key: string]: ?ItemT },
    client: Client<SyncStatus>,
    col: Collection<ItemT>,
    showAll: boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
    onNewFocus: (boolean) => void,
    path: Array<string>,
    setRootPath: (Array<string>) => void,
|}) => {
    const styles = useStyles();

    const numHidden = showAll
        ? 0
        : item.children.filter((id) => items[id] && !!items[id].completedDate).length;

    return (
        <div className={styles.itemChildren}>
            {numHidden > 0 ? (
                <div
                    className={styles.numHidden}
                    style={{
                        marginLeft: (level + 2) * INDENT,
                    }}
                >
                    {numHidden} items hidden
                </div>
            ) : null}
            {item.children
                .map((id) => items[id])
                .filter(Boolean)
                .filter((item) => showAll || item.completedDate == null)
                .map((item, i) => (
                    <Item
                        key={item.id}
                        item={item}
                        path={path}
                        showAll={showAll}
                        setRootPath={setRootPath}
                        onDragStart={onDragStart}
                        level={level + 1}
                        dragRefs={dragRefs}
                        idx={i}
                        client={client}
                    />
                ))}
            <NewItem
                onFocus={onNewFocus}
                level={level + 1}
                onAdd={(text) => {
                    const childId = client.getStamp();
                    if (text.startsWith('# ')) {
                        col.save(childId, { ...newItem(childId, text.slice(2)), style: 'group' });
                    } else {
                        col.save(childId, newItem(childId, text));
                    }
                    col.insertId(item.id, ['children'], item.children.length, childId);
                }}
            />
        </div>
    );
};

const useStyles = makeStyles((theme) => ({
    itemChildren: {
        // paddingLeft: theme.spacing(2),
    },
    numHidden: {
        color: theme.palette.text.disabled,
        paddingLeft: theme.spacing(2),
        marginBottom: theme.spacing(1),
    },
}));
