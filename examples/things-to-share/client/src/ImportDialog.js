// @flow
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import pako from 'pako';
import * as React from 'react';
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
    const [loading, setLoading] = React.useState(false);
    const id = React.useMemo(() => 'id-' + genId(), []);

    return (
        <Dialog open={open} aria-labelledby={id} onClose={onClose}>
            <DialogTitle id={id}>Data Import</DialogTitle>
            <Typography variant="body1" className={styles.text}>
                Import the things
            </Typography>
            <TextField
                disabled={loading}
                onChange={(evt) => {
                    setLoading(true);
                    if (evt.target.files.length > 0) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            try {
                                const data = JSON.parse(
                                    // $FlowFixMe
                                    pako.inflate(evt.target.result, {
                                        to: 'string',
                                    }),
                                );
                                client.importDump(data).then(
                                    () => {
                                        onClose();
                                    },
                                    (err) => {
                                        console.error(err);
                                    },
                                );
                            } catch (err) {
                                console.error(err);
                            }
                        };
                        reader.readAsArrayBuffer(evt.target.files[0]);
                    }
                }}
                id="standard-basic"
                label="Standard"
                type="file"
            />
            {/* {url ? (
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
            )} */}
        </Dialog>
    );
};

export default ExportDialog;
