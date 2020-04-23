// @flow
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
import { ItemSchema, TagSchema, HabitSchema, DaySchema } from './types';

const schemas = {
    items: ItemSchema,
    tags: TagSchema,
    habits: HabitSchema,
    days: DaySchema,
};

const App = ({
    dbName,
    host,
    auth,
    logout,
}: {
    dbName: string,
    host: string,
    auth: ?Data,
    logout: () => mixed,
}) => {
    const client = React.useMemo(() => {
        console.log('starting a client', auth);
        // return createInMemoryDeltaClient(schemas, '');
        return auth
            ? createPersistedDeltaClient(
                  dbName,
                  schemas,
                  `${host.startsWith('localhost:') ? 'ws' : 'wss'}://${host}/sync?token=${
                      auth.token
                  }`,
                  2,
              )
            : createPersistedBlobClient(dbName, schemas, null, 2);
    }, [auth && auth.token]);

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

    const contents = <Home client={client} host={host} logout={logout} auth={auth} />;
    // const contents = addingUrl ? (
    //     <div>
    //         <Adder
    //             host={host}
    //             initialUrl={addingUrl}
    //             onCancel={() => {
    //                 window.close();
    //             }}
    //             onAdd={(url, fetchedContent) => {
    //                 const id = client.getStamp();
    //                 linksCol
    //                     .save(id, {
    //                         id,
    //                         url,
    //                         fetchedContent,
    //                         added: Date.now(),
    //                         tags: {},
    //                         description: null,
    //                         completed: null,
    //                     })
    //                     .then(() => {
    //                         window.close();
    //                     });
    //             }}
    //         />
    //     </div>
    // ) : (
    //     <Home client={client} auth={auth} logout={logout} host={host} />
    // );

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
