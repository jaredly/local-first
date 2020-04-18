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
} from '../../../../packages/client-bundle';
import Adder from './Adder';
import type { Data } from './auth-api';
import Home from './Home';
// import { default as makeDeltaInMemoryPersistence } from '../../../../packages/idb/src/delta-mem';
import { LinkSchema, type LinkT, TagSchema } from './types';

const schemas = {
    tags: TagSchema,
    links: LinkSchema,
};

const rx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
const fullRx = /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/gi;
const endRx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/gi;

const App = ({
    host,
    auth,
    logout,
}: {
    host: string,
    auth: ?Data,
    logout: () => mixed,
}) => {
    const client = React.useMemo(() => {
        console.log('starting a client', auth);
        return auth
            ? createPersistedDeltaClient(
                  'things-to-share',
                  schemas,
                  `${
                      host.startsWith('localhost:') ? 'ws' : 'wss'
                  }://${host}/sync?token=${auth.token}`,
              )
            : createPersistedBlobClient(
                  'things-to-share-blob',
                  schemas,
                  null,
                  2,
              );
    }, [auth && auth.token]);

    const addingUrl = React.useMemo(() => {
        const params = querystring.parse(window.location.search.slice(1));
        if (params.url) {
            return params.url;
        }
        if (params.text) {
            const endMatch = params.text.trim().match(endRx);
            if (endMatch) {
                return endMatch[0];
            }
            const lines = params.text.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine.match(fullRx)) {
                return lastLine;
            }
            const match = params.text.match(rx);
            if (match) {
                return match[0];
            }
        }
        return null;
    }, []);

    const linksCol = React.useMemo(
        () => client.getCollection<LinkT>('links'),
        [],
    );

    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    console.log('app hello');
    React.useEffect(() => {
        if (window.upgradeAvailable) {
            console.log('listeneing');
            const listener = () => {
                console.log('listenered!');
                setShowUpgrade(true);
            };
            window.upgradeAvailable.listeners.push(listener);
            return () => {
                console.log('unlistenerd');
                window.upgradeAvailable.listeners = window.upgradeAvailable.listeners.filter(
                    (f) => f !== listener,
                );
            };
        } else {
            console.log('no upgrade support');
        }
    }, []);

    const contents = addingUrl ? (
        <div>
            <Adder
                host={host}
                initialUrl={addingUrl}
                onCancel={() => {
                    window.close();
                }}
                onAdd={(url, fetchedContent) => {
                    const id = client.getStamp();
                    linksCol
                        .save(id, {
                            id,
                            url,
                            fetchedContent,
                            added: Date.now(),
                            tags: {},
                            description: null,
                            completed: null,
                        })
                        .then(() => {
                            window.close();
                        });
                }}
            />
        </div>
    ) : (
        <Home client={client} auth={auth} logout={logout} host={host} />
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
