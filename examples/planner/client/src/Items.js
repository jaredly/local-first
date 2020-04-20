// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Divider from '@material-ui/core/Divider';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Switch from '@material-ui/core/Switch';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { type Client, type SyncStatus } from '../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../packages/client-react';
// import Adder from './Adder';
// import type { Data } from './auth-api';
// import ExportDialog from './ExportDialog';
// import ImportDialog from './ImportDialog';
// import LinkItem from './LinkItem';
// import TopBar from './TopBar';
// import EditTagDialog from './EditTagDialog';

// import Drawer from './Drawer';

import { type ItemT, newItem } from './types';

const NewItem = ({ onAdd }) => {
    const [text, setText] = React.useState('');
    const styles = useStyles();

    return (
        <div>
            <input
                type="text"
                value={text}
                onChange={(evt) => setText(evt.target.value)}
                className={styles.input}
                onKeyDown={(evt) => {
                    if (evt.key === 'Enter' && text.length > 0) {
                        onAdd(text);
                    }
                }}
            />
        </div>
    );
};

const Item = React.memo(
    ({ id, client, level }: { level: number, id: string, client: Client<SyncStatus> }) => {
        const [col, item] = useItem(React, client, 'items', id);
        const [open, setOpen] = React.useState(id === 'root');
        const styles = useStyles();
        if (!item) {
            return <div>deleted...</div>;
        }

        return (
            <div className={styles.item}>
                <div
                    className={styles.itemTitle}
                    style={{ paddingLeft: level * 24 }}
                    onClick={() => setOpen(!open)}
                >
                    <input
                        type="checkbox"
                        checked={!!item.completedDate}
                        onChange={() => {
                            col.setAttribute(
                                id,
                                ['completedDate'],
                                item.completedDate != null ? null : Date.now(),
                            );
                        }}
                        onClick={(evt) => evt.stopPropagation()}
                    />
                    {item.title}
                </div>
                {open ? (
                    <div className={styles.itemChildren}>
                        {item.children.map((child) => (
                            <Item level={level + 1} id={child} key={child} client={client} />
                        ))}
                        <NewItem
                            onAdd={(text) => {
                                const childId = client.getStamp();
                                col.save(childId, newItem(childId, text));
                                col.insertId(id, ['children'], item.children.length, childId);
                            }}
                        />
                    </div>
                ) : null}
            </div>
        );
    },
);

const Items = ({ client }: { client: Client<SyncStatus> }) => {
    // const [itemsCol, items] = useCollection(React, client, 'items');
    // const [tagsCol, tags] = useCollection(React, client, 'tags');

    const styles = useStyles();

    // STOPSHIP TODO indicate "loading" vs "missing"
    const [col, root] = useItem(React, client, 'items', 'root');

    return (
        <Container maxWidth="sm" className={styles.container}>
            {root ? (
                <Item level={0} id="root" client={client} />
            ) : (
                <div className={styles.empty}>
                    Hello! Let's get you started.
                    <Button
                        onClick={() => {
                            col.save('root', newItem('root', 'Planner'));
                        }}
                    >
                        Start this off
                    </Button>
                </div>
            )}
        </Container>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {},
    input: {
        width: '100%',
        fontSize: 32,
        padding: '4px 8px',
    },
    item: {},
    itemTitle: {
        cursor: 'pointer',
        padding: `${theme.spacing(1)}px ${theme.spacing(3)}px`,
        '&:hover': {
            backgroundColor: theme.palette.primary.light,
        },
    },
    itemChildren: {
        // paddingLeft: theme.spacing(2),
    },
}));

export default Items;
