// @flow
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import pako from 'pako';
import * as React from 'react';
import type { Client } from '../../packages/client-bundle';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

const useStyles = makeStyles(theme => ({
    text: {
        padding: theme.spacing(2),
    },
}));

const ExportDialog = ({
    client,
    onClose,
    open,
}: {
    client: Client<*>,
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
                If you want to move your data to another server, you can export all data, download
                it as an archive, and then upload it once you've logged into the new server. You can
                even do this multiple times, and the exports will merge correctly.
            </Typography>
            {url != null ? (
                <Button
                    variant="contained"
                    color="primary"
                    disabled={loading}
                    href={url}
                    download={'export-' + new Date().toDateString() + '.dump.gz'}
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
                        client.fullExport().then(
                            data => {
                                const compressed = pako.deflate(JSON.stringify(data));
                                const blob = new Blob([compressed], {
                                    type: 'application/json',
                                });
                                const url = URL.createObjectURL(blob);
                                setUrl(url);
                                setLoading(false);
                            },
                            err => {
                                console.error(err);
                            },
                        );
                    }}
                >
                    {loading ? 'Processing...' : 'Export all data'}
                </Button>
            )}
        </Dialog>
    );
};

export default ExportDialog;
