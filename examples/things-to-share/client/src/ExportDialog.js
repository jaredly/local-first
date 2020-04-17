// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import AppBar from '@material-ui/core/AppBar';
import Switch from '@material-ui/core/Switch';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';

import MenuIcon from '@material-ui/icons/Menu';

import pako from 'pako';

import { makeStyles } from '@material-ui/core/styles';

import type { Client, SyncStatus } from '../../../../packages/client-bundle';

const genId = () => Math.random().toString(36).slice(2);

const useStyles = makeStyles((theme) => ({
    text: {
        padding: theme.spacing(2),
    },
}));

const ExportDialog = ({
    client,
    onClose,
    open,
}: {
    client: Client<SyncStatus>,
    onClose: () => void,
    open: boolean,
}) => {
    const styles = useStyles();
    const [url, setUrl] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const id = React.useMemo(() => 'id-' + genId(), []);

    return (
        <Dialog open={open} aria-labelledby={id} onClose={onClose}>
            <DialogTitle id={id}>Data Export</DialogTitle>
            <Typography variant="body1" className={styles.text}>
                If you want to move your data to another server, you can export
                all data, download it as an archive, and then upload it once
                you've logged into the new server. You can even do this multiple
                times, and the exports will merge correctly.
            </Typography>
            {url != null ? (
                <Button
                    variant="contained"
                    color="primary"
                    disabled={loading}
                    href={url}
                    download={
                        'export-' + new Date().toDateString() + '.dump.gz'
                    }
                >
                    Download
                </Button>
            ) : (
                <Button
                    variant="contained"
                    color="primary"
                    disabled={loading}
                    onClick={() => {
                        setLoading(true);
                        client.fullExport().then((data) => {
                            const compressed = pako.deflate(
                                JSON.stringify(data),
                            );
                            const blob = new Blob([compressed], {
                                type: 'application/json',
                            });
                            const url = URL.createObjectURL(blob);
                            setUrl(url);
                        });
                    }}
                >
                    {loading ? 'Processing...' : 'Export all data'}
                </Button>
            )}
        </Dialog>
    );
};

export default ExportDialog;
