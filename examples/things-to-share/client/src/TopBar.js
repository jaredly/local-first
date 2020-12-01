// @flow
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Wifi from '@material-ui/icons/Wifi';
import SearchIcon from '@material-ui/icons/Search';
import WifiOff from '@material-ui/icons/WifiOff';
import Menu from '@material-ui/core/Menu';
import Hidden from '@material-ui/core/Hidden';
import MenuItem from '@material-ui/core/MenuItem';
import CachedIcon from '@material-ui/icons/Cached';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuIcon from '@material-ui/icons/Menu';
import * as React from 'react';
import type { Data } from './auth-api';

import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import { useSyncStatus } from '../../../../packages/client-react';

const TopBar = ({
    auth,
    setDialog,
    openMenu,
    logout,
    onSearch,
    client,
}: {
    auth: ?Data,
    openMenu: () => void,
    setDialog: ('export' | 'import') => void,
    logout: () => mixed,
    onSearch: () => mixed,
    client: Client<SyncStatus>,
}) => {
    const styles = useStyles();
    const syncStatus = useSyncStatus(React, client);

    return (
        <AppBar position="sticky">
            <Toolbar>
                <IconButton
                    edge="start"
                    className={styles.menuButton}
                    color="inherit"
                    aria-label="menu"
                    onClick={openMenu}
                >
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" className={styles.title}>
                    Things to Share
                </Typography>
                <IconButton
                    edge="start"
                    className={styles.menuButton}
                    color="inherit"
                    aria-label="menu"
                    onClick={onSearch}
                >
                    <SearchIcon />
                </IconButton>
                <div style={{ width: 24, height: 24 }}>
                    {syncStatus.status === 'connected' ? (
                        <Wifi className={styles.connected} />
                    ) : syncStatus.status === 'disconnected' ? (
                        <WifiOff className={styles.disconnected} />
                    ) : (
                        <CircularProgress
                            className={styles.loading}
                            size={24}
                        />
                    )}
                </div>
            </Toolbar>
        </AppBar>
    );
};

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
    loading: {
        color: 'white',
    },
}));

export default TopBar;
