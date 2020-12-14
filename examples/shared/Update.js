// @flow

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
// import querystring from 'querystring';
// import ListItem from '@material-ui/core/ListItem';
// import Switch from '@material-ui/core/Switch';
// import FormControlLabel from '@material-ui/core/FormControlLabel';
import * as React from 'react';
// import {
//     createPersistedBlobClient,
//     createPersistedDeltaClient,
//     createPollingPersistedDeltaClient,
//     createInMemoryDeltaClient,
//     createInMemoryEphemeralClient,
// } from '../../../packages/client-bundle';
// import { useCollection, useItem } from '../../../packages/client-react';
// import type { Data } from '../../shared/auth-api';
// import type { AuthData } from '../../shared/Auth';

// import schemas from '../collections';
// import Item from './Item';
// import LocalClient from './LocalClient';
// import { type DropTarget } from './dragging';
// import AppShell from '../../shared/AppShell';
// import { setupDragListeners, type DragInit, type DragState } from './dragging';
// import Drawer from './Drawer';

// import { Switch as RouteSwitch } from 'react-router-dom';

// import { blankItem } from './types';

const UpdateSnackbar = () => {
    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    // TODO dedup this, it's a little ridiculous
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
                    f => f !== listener,
                );
            };
        } else {
            console.log('no upgrade support');
        }
    }, []);

    return (
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
    );
};

export default UpdateSnackbar;
