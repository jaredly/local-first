// @flow
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuIcon from '@material-ui/icons/Menu';
import * as React from 'react';
import type { Data } from './auth-api';

const TopBar = ({
    auth,
    setDialog,
    logout,
}: {
    auth: ?Data,
    setDialog: ('export' | 'import') => void,
    logout: () => mixed,
}) => {
    const styles = useStyles();
    const [menuOpen, setMenuOpen] = React.useState(false);

    const anchorEl = React.useRef(null);

    return (
        <AppBar position="sticky">
            <Toolbar>
                <IconButton
                    edge="start"
                    className={styles.menuButton}
                    color="inherit"
                    aria-label="menu"
                >
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" className={styles.title}>
                    Things to Share
                </Typography>

                {/* 
                <div
                    style={{
                        flexWrap: 'wrap',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Typography>Show completed</Typography>
                    <Switch
                            checked={showAll}
                            onChange={() => setShowAll(!showAll)}
                        />
                </div> */}

                <Button
                    color="inherit"
                    onClick={(evt) => setMenuOpen(true)}
                    ref={(node) => (anchorEl.current = node)}
                    className={styles.userButton}
                >
                    {auth ? auth.user.email : 'Login to sync'}
                </Button>

                <Menu
                    anchorEl={anchorEl.current}
                    keepMounted
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                >
                    <MenuItem
                        onClick={() => {
                            setMenuOpen(false);
                            logout();
                        }}
                    >
                        Log out
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setDialog('export');
                            setMenuOpen(false);
                        }}
                    >
                        Export Data
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setDialog('import');
                            setMenuOpen(false);
                        }}
                    >
                        Import Data
                    </MenuItem>
                </Menu>
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
}));

export default TopBar;
