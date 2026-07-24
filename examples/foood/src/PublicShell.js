// @flow
import * as React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import HomeIcon from '@material-ui/icons/Home';
import ListIcon from '@material-ui/icons/List';
import MenuIcon from '@material-ui/icons/Menu';
import PersonIcon from '@material-ui/icons/Person';
import SearchIcon from '@material-ui/icons/Search';
import { Link } from 'react-router-dom';

const useStyles = makeStyles((theme) => ({
    title: {
        flex: 1,
    },
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    drawer: {
        width: 260,
    },
}));

const items = [
    { label: 'Home', path: '/', icon: HomeIcon },
    { label: 'All Recipes', path: '/latest', icon: ListIcon },
    { label: 'Search', path: '/search', icon: SearchIcon },
    { label: 'Login', path: '/login', icon: PersonIcon },
];

const PublicShell = ({ children }: { children: React.Node }) => {
    const styles = useStyles();
    const [open, setOpen] = React.useState(false);

    return (
        <React.Fragment>
            <AppBar position="sticky">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="open navigation"
                        onClick={() => setOpen(true)}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" className={styles.title}>
                        <Link style={{ color: 'inherit', textDecoration: 'none' }} to="/">
                            Foood
                        </Link>
                    </Typography>
                    <IconButton
                        color="inherit"
                        component={Link}
                        to="/search"
                        aria-label="search recipes"
                    >
                        <SearchIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
                <List className={styles.drawer}>
                    {items.map((item, index) => {
                        const ItemIcon = item.icon;
                        return (
                            <React.Fragment key={item.path}>
                                {index === items.length - 1 ? <Divider /> : null}
                                <ListItem
                                    button
                                    component={Link}
                                    to={item.path}
                                    onClick={() => setOpen(false)}
                                >
                                    <ListItemIcon>
                                        <ItemIcon />
                                    </ListItemIcon>
                                    <ListItemText primary={item.label} />
                                </ListItem>
                            </React.Fragment>
                        );
                    })}
                </List>
            </Drawer>
            <Container maxWidth="md" className={styles.container}>
                {children}
            </Container>
        </React.Fragment>
    );
};

export default PublicShell;
