// @flow
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';

import querystring from 'querystring';
import ListItem from '@material-ui/core/ListItem';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import * as React from 'react';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
    createInMemoryEphemeralClient,
} from '../../../packages/client-bundle';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import AddIcon from '@material-ui/icons/Add';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from '../../shared/auth-api';
import type { AuthData } from '../../shared/Auth';

import { schemas, type RecipeT } from '../collections';
import { schemas as privateSchemas } from '../private-collections';
import AppShell from '../../shared/AppShell';
import Drawer from './Drawer';
import UpdateSnackbar from '../../shared/Update';
import Editor from './Editor';
import Home from './Home';
import RecipeView from './Recipe';
import Search from './Search';
import EditorView from './EditorView';
import Latest from './Latest';
import Debug from './Debug';
import Ingredients from './Ingredients';

import MealPlans from './MealPlans';
import Settings from './Settings';
import EditMealPlan from './EditMealPlan';
import MealPlan from './MealPlans';

import { Switch as RouteSwitch } from 'react-router-dom';

export type ConnectionConfig =
    | {
          type: 'memory',
      }
    | {
          type: 'remote',
          prefix: string,
          authData: AuthData,
      };

const parseRawDoc = (rawDoc) => {
    if (!rawDoc || !rawDoc.trim().length) {
        return [null, null];
    }
    const parts = rawDoc.split(':');
    if (parts.length === 1) {
        return [rawDoc, null];
    }
    return [parts[0], parts[1]];
};

const App = ({ config }: { config: ConnectionConfig }) => {
    const [client, privateClient] = React.useMemo(() => {
        if (config.type === 'memory') {
            // return createInMemoryEphemeralClient(schemas);
            throw new Error('hm');
        }
        const url = `${config.authData.host}/dbs/sync?db=foood/public&token=${config.authData.auth.token}`;
        const privateUrl = `${config.authData.host}/dbs/sync?db=foood-private&token=${config.authData.auth.token}`;
        return [
            createPollingPersistedDeltaClient(
                config.prefix,
                schemas,
                `${config.authData.host.startsWith('localhost:') ? 'http' : 'https'}://${url}`,
                3,
                {},
                30 * 1000,
            ),
            createPollingPersistedDeltaClient(
                config.prefix + '-private',
                privateSchemas,
                `${
                    config.authData.host.startsWith('localhost:') ? 'http' : 'https'
                }://${privateUrl}`,
                5,
                {},
                30 * 1000,
            ),
        ];
    }, [config.type === 'remote' ? config.authData : null]);
    React.useEffect(() => {
        if (config.type !== 'remote') {
            return;
        }
        return config.authData.onLogout(() => {
            client.teardown();
        });
    }, [client, config.type === 'remote' ? config.authData : null]);
    const match = useRouteMatch();
    const history = useHistory();

    const url =
        config.type === 'remote'
            ? (config.authData.host.startsWith('localhost:') ? 'http://' : 'https://') +
              config.authData.host
            : 'no-host://';

    const authData = config.type === 'remote' ? config.authData : null;

    window.client = client;
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');

    const pathPrefix = match.path == '/' ? '' : match.path;

    const actorId = authData ? '' + authData.auth.user.id : 'main';

    return (
        <div>
            <AppShell
                title="Foood"
                renderDrawer={(isOpen, onClose) => (
                    <Drawer
                        actorId={actorId}
                        pageItems={null}
                        onClose={onClose}
                        open={isOpen}
                        authData={authData}
                        client={client}
                    />
                )}
                topIcons={
                    <React.Fragment>
                        <IconButton
                            edge="start"
                            style={{ marginRight: 16 }}
                            color="inherit"
                            aria-label="menu"
                            href={'/recipe/new'}
                            onClick={(evt) => {
                                if (evt.button == 0 && !evt.ctrlKey && !evt.metaKey) {
                                    history.push('/recipe/new');
                                    evt.preventDefault();
                                    evt.stopPropagation();
                                }
                            }}
                        >
                            <AddIcon />
                        </IconButton>
                        <IconButton
                            edge="start"
                            style={{ marginRight: 16 }}
                            color="inherit"
                            aria-label="menu"
                            href={'/search'}
                            onClick={(evt) => {
                                if (evt.button == 0 && !evt.ctrlKey && !evt.metaKey) {
                                    history.push('/search');
                                    evt.preventDefault();
                                    evt.stopPropagation();
                                }
                            }}
                        >
                            <SearchIcon />
                        </IconButton>
                    </React.Fragment>
                }
                drawerItems={null}
                authData={authData}
                client={client}
            >
                <RouteSwitch>
                    <Route path={`${pathPrefix}/recipe/new`}>
                        <Editor
                            actorId={actorId}
                            url={url}
                            client={client}
                            onCancel={() => history.back()}
                            tags={{}}
                            about={blankRecipe.about}
                            meta={blankRecipe.contents.meta}
                            text={blankRecipe.contents.text}
                            status={'to try'}
                            onSave={(about, meta, text, status) => {
                                const id = client.getStamp();
                                col.save(id, {
                                    id,
                                    about,
                                    statuses: status != null ? { [(actorId: string)]: status } : {},
                                    createdDate: Date.now(),
                                    updatedDate: Date.now(),
                                    contents: {
                                        meta,
                                        text,
                                        changeLog: [],
                                        version: id,
                                    },
                                    comments: {},
                                    tags: {},
                                })
                                    .catch((err) => {
                                        console.error('error', err);
                                    })
                                    .then(() => {
                                        history.push(`/recipe/${id}`);
                                    });
                            }}
                            recipe={blankRecipe}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/ingredients`}>
                        <Ingredients
                            client={client}
                            privateClient={privateClient}
                            actorId={actorId}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/plans/:id/edit`}>
                        <EditMealPlan
                            url={url}
                            client={client}
                            privateClient={privateClient}
                            actorId={actorId}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/plans/:id`}>
                        <MealPlan
                            url={url}
                            client={client}
                            privateClient={privateClient}
                            actorId={actorId}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/plans`}>
                        <MealPlans
                            url={url}
                            client={client}
                            privateClient={privateClient}
                            actorId={actorId}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/settings`}>
                        <Settings
                            url={url}
                            client={client}
                            privateClient={privateClient}
                            actorId={actorId}
                        />
                    </Route>
                    <Route path={`${pathPrefix}/search`}>
                        <Search url={url} client={client} actorId={actorId} />
                    </Route>
                    <Route path={`${pathPrefix}/tag/:tagid`}>
                        <Home url={url} actorId={actorId} client={client} />
                    </Route>
                    <Route path={`${pathPrefix}/recipe/:id/title/:title`}>
                        <RecipeView url={url} actorId={actorId} client={client} />
                    </Route>
                    <Route path={`${pathPrefix}/recipe/:id/edit`}>
                        <EditorView url={url} actorId={actorId} client={client} />
                    </Route>
                    <Route path={`${pathPrefix}/recipe/:id`}>
                        <RecipeView url={url} actorId={actorId} client={client} />
                    </Route>
                    <Route path={`${pathPrefix}/latest`}>
                        <Latest url={url} actorId={actorId} client={client} />
                    </Route>
                    <Route path={`${pathPrefix}/debug`}>
                        <Debug client={client} />
                    </Route>
                    <Route path={`${pathPrefix}`}>
                        <Home url={url} actorId={actorId} client={client} />
                    </Route>
                </RouteSwitch>
            </AppShell>
            {/* )} */}
            <UpdateSnackbar />
        </div>
    );
};

const blankRecipe: RecipeT = {
    id: '',
    about: {
        title: '',
        author: '',
        source: '',
        image: '',
    },
    statuses: {},
    createdDate: 0,
    updatedDate: 0,
    contents: {
        meta: {
            ovenTemp: null,
            cookTime: null,
            totalTime: null,
            prepTime: null,
            yield: null,
        },
        text: { ops: [{ insert: '\n' }] },
        changeLog: [],
        version: '',
    },
    comments: {},
    tags: {},
};

export default App;
