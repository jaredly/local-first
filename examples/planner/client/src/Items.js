// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Divider from '@material-ui/core/Divider';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import IconButton from '@material-ui/core/IconButton';
import Switch from '@material-ui/core/Switch';
import AccountCircle from '@material-ui/icons/AccountCircle';
import ExitToApp from '@material-ui/icons/ExitToApp';
import AddBoxOutlined from '@material-ui/icons/Add';
import GetApp from '@material-ui/icons/GetApp';
import Publish from '@material-ui/icons/Publish';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import { type Client, type SyncStatus } from '../../../../packages/client-bundle';
import { useCollection, useItem } from '../../../../packages/client-react';
import Checkbox from '@material-ui/core/Checkbox';

import { type ItemT, newItem } from './types';

import { Item, ItemChildren } from './Item';

const useStyles = makeStyles((theme) => ({
    container: {},
    input: {
        color: 'inherit',
        width: '100%',
        fontSize: 32,
        padding: '4px 8px',
        backgroundColor: 'inherit',
        border: 'none',
        borderBottom: `2px solid ${theme.palette.primary.dark}`,
    },
    inputWrapper: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        '&:hover': {
            backgroundColor: theme.palette.primary.light,
        },
    },
    itemWrapper: {},
    item: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        cursor: 'pointer',
        // padding: `${theme.spacing(1)}px ${theme.spacing(3)}px`,
        '&:hover': {
            backgroundColor: theme.palette.primary.light,
        },
    },
    itemTitle: {
        // padding: theme.spacing(2),
        ...theme.typography.h4,
    },
    itemChildren: {
        // paddingLeft: theme.spacing(2),
    },
}));

const Items = ({ client }: { client: Client<SyncStatus> }) => {
    const styles = useStyles();

    const [col, root] = useItem(React, client, 'items', 'root');

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Button onClick={() => client.undo()}>Undo</Button>
            {root ? (
                <ItemChildren level={-1} item={root} client={client} col={col} />
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
