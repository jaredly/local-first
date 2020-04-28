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
    show,
    path,
    dragRefs,
    onDragStart,
    onNewFocus,
    setRootPath,
    selection,
}: {|
    item: ItemT,
    level: number,
    items: { [key: string]: ?ItemT },
    client: Client<SyncStatus>,
    col: Collection<ItemT>,
    show: (ItemT) => boolean,
    dragRefs: DragRefs,
    onDragStart: (DragInit) => void,
    onNewFocus: (boolean) => void,
    path: Array<string>,
    setRootPath: (Array<string>) => void,
    selection?: ?{ map: { [key: string]: boolean }, set: (string, boolean) => void },
|}) => {
    const styles = useStyles();
    const [showAnyway, setShowAnyway] = React.useState(false);

    const showAlso = {};
    if (!selection) {
        const completed = item.children
            .filter((id) => items[id] && items[id].completedDate != null)
            // $FlowFixMe
            .sort((a, b) => items[b].completedDate - items[a].completedDate);
        for (let i = 0; i < 2 && i < completed.length; i++) {
            showAlso[completed[i]] = true;
        }
    }

    const existent = item.children.map((id) => items[id]).filter(Boolean);

    const toShow = existent.filter((item) => showAnyway || showAlso[item.id] || show(item));

    const numHidden = existent.length - toShow.length;

    return (
        <div className={styles.itemChildren}>
            {numHidden > 0 ? (
                <div
                    className={styles.numHidden}
                    onClick={() => setShowAnyway(true)}
                    style={{
                        marginLeft: (level + 2) * INDENT,
                    }}
                >
                    {numHidden} items hidden
                </div>
            ) : null}
            {showAnyway ? (
                <div
                    className={styles.numHidden}
                    onClick={() => setShowAnyway(false)}
                    style={{
                        marginLeft: (level + 2) * INDENT,
                    }}
                >
                    Hide old completed items
                </div>
            ) : null}
            {toShow.map((item, i) => (
                <Item
                    key={item.id}
                    item={item}
                    path={path}
                    show={show}
                    setRootPath={setRootPath}
                    onDragStart={onDragStart}
                    level={level + 1}
                    dragRefs={dragRefs}
                    idx={i}
                    selection={selection}
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
