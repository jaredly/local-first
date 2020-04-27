// @flow
import { Switch, Route, Link, useRouteMatch, useParams } from 'react-router-dom';

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
import querystring from 'querystring';
import * as React from 'react';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createInMemoryDeltaClient,
} from '../../../../packages/client-bundle';
// import Adder from './Adder';
import type { Data } from './auth-api';

import Home from './Home';
import { ItemSchema, TagSchema, HabitSchema, DaySchema, TimeSchema } from './types';
import Schedule from './Schedule/Schedule';
import Split from './Split';
import Habits from './Habits/Habits';

const schemas = {
    items: ItemSchema,
    tags: TagSchema,
    habits: HabitSchema,
    days: DaySchema,
    times: TimeSchema,
};

export type AuthData = { host: string, auth: Data, logout: () => mixed };

const App = ({ dbName, authData }: { dbName: string, authData: ?AuthData }) => {
    const client = React.useMemo(() => {
        console.log('starting a client', authData);
        // return createInMemoryDeltaClient(schemas, '');
        return authData
            ? createPersistedDeltaClient(
                  dbName,
                  schemas,
                  `${authData.host.startsWith('localhost:') ? 'ws' : 'wss'}://${
                      authData.host
                  }/sync?token=${authData.auth.token}`,
                  3,
                  {
                      times: {
                          // for getting in-process time tracks
                          end: { keyPath: ['value', 'value', 'end'] },
                      },
                      items: {
                          completedDate: { keyPath: ['value', 'value', 'completedDate'] },
                          dueDate: { keyPath: ['value', 'value', 'dueDate'] },
                          style: { keyPath: ['value', 'value', 'style'] },
                      },
                      habits: {
                          archived: { keyPath: ['value', 'value', 'archived'] },
                      },
                  },
              )
            : createPersistedBlobClient(dbName, schemas, null, 3);
    }, [authData]);

    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    React.useEffect(() => {
        if (window.upgradeAvailable) {
            const listener = () => {
                setShowUpgrade(true);
            };
            window.upgradeAvailable.listeners.push(listener);
            return () => {
                window.upgradeAvailable.listeners = window.upgradeAvailable.listeners.filter(
                    (f) => f !== listener,
                );
            };
        } else {
            console.log('no upgrade support');
        }
    }, []);

    let match = useRouteMatch();
    console.log(match);

    const pathPrefix = match.path == '/' ? '' : match.path;

    const contents = (
        <Switch>
            <Route path={`${pathPrefix}/split/:day`}>
                <Split client={client} authData={authData} />
            </Route>
            <Route path={`${pathPrefix}/day/:day`}>
                <Schedule client={client} authData={authData} />
            </Route>
            {/* TODO combine host, login, auth */}
            <Route path={`${pathPrefix}/habits`}>
                <Habits client={client} authData={authData} />
            </Route>
            <Route path={match.path}>
                <Home client={client} authData={authData} />
            </Route>
        </Switch>
    );

    return (
        <React.Fragment>
            {contents}
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={showUpgrade}
                autoHideDuration={6000}
                onClose={() => setShowUpgrade(false)}
                message="Update available"
                action={
                    <React.Fragment>
                        <Button
                            color="secondary"
                            size="small"
                            onClick={() => {
                                window.upgradeAvailable.waiting.postMessage({
                                    type: 'SKIP_WAITING',
                                });
                                setShowUpgrade(false);
                            }}
                        >
                            Reload
                        </Button>
                        <IconButton
                            size="small"
                            aria-label="close"
                            color="inherit"
                            onClick={() => setShowUpgrade(false)}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </React.Fragment>
                }
            />
        </React.Fragment>
    );
};

export default App;
