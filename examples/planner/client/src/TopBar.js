// @flow
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuIcon from '@material-ui/icons/Menu';
import * as React from 'react';
import type { Data } from './auth-api';
import { Link } from 'react-router-dom';

const today = () => {
    const now = new Date();
    // start of day
    now.setHours(0, 0, 0, 0);
    return now;
};

const tomorrow = () => {
    const now = today();
    // half a day should get us to tomorrow
    now.setTime(now.getTime() + 36 * 3600 * 1000);
    now.setHours(0, 0, 0, 0);
    return now;
};

const showDate = (date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

const TopBar = ({
    auth,
    setDialog,
    openMenu,
    logout,
}: {
    auth: ?Data,
    openMenu: () => void,
    setDialog: ('export' | 'import') => void,
    logout: () => mixed,
}) => {
    const styles = useStyles();

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
                    Planner
                </Typography>
                <Link to={`/day/${showDate(today())}`}>Today's Schedule</Link>
                <Link to={`/day/${showDate(tomorrow())}`}>Tomorrow's Schedule</Link>
            </Toolbar>
        </AppBar>
    );
};

const useStyles = makeStyles((theme) => ({
    title: {
        flexGrow: 1,
    },
    menuButton: {
        marginRight: (console.log(theme.palette), theme.spacing(2)),
    },
}));

export default TopBar;
