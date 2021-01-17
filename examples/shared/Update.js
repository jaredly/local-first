// @flow

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';
import * as React from 'react';

export const useUpgrade = () => {
    const [showUpgrade, setShowUpgrade] = React.useState(
        window.upgradeAvailable && window.upgradeAvailable.installed,
    );

    React.useEffect(() => {
        if (window.upgradeAvailable) {
            // console.log('listeneing');
            const listener = () => {
                // console.log('listenered!');
                setShowUpgrade(true);
            };
            window.upgradeAvailable.listeners.push(listener);
            return () => {
                // console.log('unlistenerd');
                window.upgradeAvailable.listeners = window.upgradeAvailable.listeners.filter(
                    f => f !== listener,
                );
            };
        } else {
            console.log('no upgrade support');
        }
    }, []);

    const hideUpgrade = React.useCallback(() => setShowUpgrade(false), []);
    const acceptUpgrade = React.useCallback(() => {
        window.upgradeAvailable.waiting.postMessage({
            type: 'SKIP_WAITING',
        });
        hideUpgrade();
    });

    return [showUpgrade, acceptUpgrade, hideUpgrade];
};

const UpdateSnackbar = React.memo<{}>(() => {
    const [upgradeAvailable, acceptUpgrade, hideUpgradeAvaialble] = useUpgrade();

    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            open={upgradeAvailable}
            autoHideDuration={6000}
            onClose={() => hideUpgradeAvaialble()}
            message="Update available"
            action={
                <React.Fragment>
                    <Button color="secondary" size="small" onClick={() => acceptUpgrade()}>
                        Reload
                    </Button>
                    <IconButton
                        size="small"
                        aria-label="close"
                        color="inherit"
                        onClick={() => hideUpgradeAvaialble()}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </React.Fragment>
            }
        />
    );
});

export default UpdateSnackbar;
