// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';

import Container from '@material-ui/core/Container';
import Button from '@material-ui/core/Button';
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuIcon from '@material-ui/icons/Menu';
import Wifi from '@material-ui/icons/Wifi';
import WifiOff from '@material-ui/icons/WifiOff';
import CircularProgress from '@material-ui/core/CircularProgress';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

import Auth from '../../shared/Auth';
import App, { type ConnectionConfig } from './App';
import { RecipeInner } from './Recipe';

const useRecipe = (host, id) => {
    const [data, setData] = React.useState(null);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        (async () => {
            const res = await fetch(
                `${window.location.protocol}//${host}/latest/?db=foood/public&id=${id}&collection=recipes`,
            );
            if (res.status === 404) {
                return setData(false);
            }
            const data = await res.json();
            setData(data);
        })().catch((err) => {
            setError(true);
        });
    }, [host, id]);
    return [data, error];
};

const PublicRecipe = ({ host }: { host: string }) => {
    const styles = useStyles();
    const { id } = useParams();

    const [recipe, error] = useRecipe(host, id);

    return (
        <React.Fragment>
            <AppBar position="sticky">
                <Toolbar>
                    {/* <IconButton
                    edge="start"
                    className={styles.menuButton}
                    color="inherit"
                    aria-label="menu"
                    onClick={openMenu}
                >
                    <MenuIcon />
                </IconButton> */}
                    <Typography variant="h6">Foood</Typography>
                    <div style={{ flex: 1 }} />
                    <Button variant="contained" component={Link} to="/">
                        Login
                    </Button>
                </Toolbar>
            </AppBar>
            <Container maxWidth={'md'} className={styles.container}>
                {recipe == null ? (
                    'Loading...'
                ) : recipe === false ? (
                    'Recipe not found'
                ) : (
                    <RecipeInner
                        url={`${window.location.protocol}//${host}`}
                        editorData={null}
                        recipe={recipe}
                    />
                )}
            </Container>
        </React.Fragment>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
}));

export default PublicRecipe;
