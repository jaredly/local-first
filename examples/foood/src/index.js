// @flow
import { render } from 'react-dom';
import React from 'react';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';

import 'typeface-roboto';

import CssBaseline from '@material-ui/core/CssBaseline';

import Auth from '../../shared/Auth';
import SignUpIn from '../../shared/SignUpIn';
import App from './App';
import PublicHome from './PublicHome';
import PublicLatest from './PublicLatest';
import PublicRecipe from './PublicRecipe';
import PublicSearch from './PublicSearch';
import PublicShell from './PublicShell';
import { recoverMissingReplica } from './recoverPersistence';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',
        primary: {
            main: '#ff9800',
        },
        secondary: {
            main: '#00e5ff',
        },
    },
});

const PublicRoutes = ({
    host,
    prefix,
    includePublicAlias,
}: {
    host: string,
    prefix: string,
    includePublicAlias?: boolean,
}) => (
    <PublicShell>
        <Switch>
            {includePublicAlias ? (
                <Route path="/public/recipe/:id">
                    <PublicRecipe host={host} />
                </Route>
            ) : null}
            <Route path="/login">
                <SignUpIn host={host} storageKey={prefix + '/auth'} />
            </Route>
            <Route path="/recipe/:id">
                <PublicRecipe host={host} />
            </Route>
            <Route path="/latest">
                <PublicLatest host={host} />
            </Route>
            <Route path="/search">
                <PublicSearch host={host} />
            </Route>
            <Route path="/">
                <PublicHome host={host} />
            </Route>
        </Switch>
    </PublicShell>
);

const Main = ({ host, prefix }: { host?: ?string, prefix?: ?string }) => {
    if (host == null || prefix == null) {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <App config={{ type: 'memory' }} />
            </ThemeProvider>
        );
    }
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Router>
                <Switch>
                    <Route path="/public/recipe/:id">
                        <PublicRoutes host={host} prefix={prefix} includePublicAlias={true} />
                    </Route>
                    <Route path="/">
                        <Auth
                            storageKey={prefix + '/auth'}
                            allowLoggedOut={true}
                            host={host}
                            render={(authData) =>
                                authData ? (
                                    <Switch>
                                        <Route path="/login">
                                            <Redirect to="/" />
                                        </Route>
                                        <Route path="/">
                                            <App
                                                config={{
                                                    type: 'remote',
                                                    prefix,
                                                    authData,
                                                }}
                                            />
                                        </Route>
                                    </Switch>
                                ) : (
                                    <PublicRoutes host={host} prefix={prefix} />
                                )
                            }
                        />
                    </Route>
                </Switch>
            </Router>
        </ThemeProvider>
    );
};

type Target = {
    host: string,
    prefix: string,
};

const getTarget = (): Target => {
    const useLocal = window.localStorage.useLocalFoood === 'true';
    return window.location.hostname === 'localhost' && useLocal
        ? { host: 'localhost:9090', prefix: 'foood-local' }
        : { host: 'logic.jaredforsyth.com', prefix: 'foood' };
};

const Top = ({ host, prefix }: Target) => {
    return <Main host={host} prefix={prefix} />;
};

const run = async () => {
    const target = getTarget();
    try {
        if (await recoverMissingReplica(target.prefix)) {
            return;
        }
    } catch (err) {
        console.error('Unable to check Foood persistence; continuing startup', err);
    }

    const node = document.createElement('div');
    if (!document.body) {
        return;
    }
    document.body.appendChild(node);
    render(<Top {...target} />, node);
};

export default run;
