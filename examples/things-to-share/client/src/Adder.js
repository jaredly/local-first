// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { makeStyles } from '@material-ui/core/styles';

import OpenGraph from './OpenGraph';

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden',
    },
    root: {
        padding: theme.spacing(2),
    },
    titleButton: {
        textTransform: 'none',
    },
    addButton: {
        width: '100%',
    },
    topBar: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        display: 'flex',
        flexDirection: 'row',
        // padding: theme.spacing(2),
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
    },
    cardBackdrop: {
        padding: theme.spacing(2),
        backgroundColor: theme.palette.primary.light,
        width: '100%',
    },
}));

const Adder = ({
    onAdd,
    host,
}: {
    host: string,
    onAdd: (string, mixed) => void,
}) => {
    const styles = useStyles();
    const [open, setOpen] = React.useState(true);
    return (
        <Paper className={styles.container}>
            <div className={styles.topBar}>
                <Button
                    color="primary"
                    variant="contained"
                    fullWidth
                    onClick={() => setOpen(true)}
                    // className={styles.topBar}
                >
                    {/* <div className={styles.topBar}> */}
                    <Typography className={styles.titleButton} variant="h4">
                        Add link
                    </Typography>
                </Button>
                {open ? (
                    <div
                        style={{
                            top: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            position: 'absolute',
                            marginRight: 4,
                            right: 0,
                        }}
                    >
                        <IconButton
                            onClick={(evt) => {
                                evt.stopPropagation();
                                setOpen(false);
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </div>
                ) : null}
                {/* </div> */}
            </div>
            {open ? <AdderBody host={host} onAdd={onAdd} /> : null}
        </Paper>
    );
};

const AdderBody = ({
    onAdd,
    host,
}: {
    host: string,
    onAdd: (string, mixed) => void,
}) => {
    const styles = useStyles();
    const [link, setLink] = React.useState('');
    const [data, setData] = React.useState(null);
    // const [tags, setTags] = React.useState({});
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const key = '.x_saved_data';
        if (data) {
            localStorage[key] = JSON.stringify(data);
        } else if (localStorage[key]) {
            const data = JSON.parse(localStorage[key]);
            setData(data);
            setLink(data['og:url'][0]);
        }
    }, [data]);

    return (
        <React.Fragment>
            {data && !data.failed && Object.keys(data).length > 0 ? (
                <div className={styles.cardBackdrop}>
                    <OpenGraph data={data} url={link} />
                </div>
            ) : null}
            <Grid
                container
                direction="column"
                spacing={2}
                alignItems="stretch"
                className={styles.root}
            >
                <Grid container item spacing={1} alignItems="center">
                    <Grid item xs>
                        <TextField
                            value={link}
                            fullWidth
                            variant="outlined"
                            label="Link"
                            disabled={loading}
                            onChange={(evt) => setLink(evt.target.value)}
                        />
                    </Grid>
                    <Grid item>
                        <Button
                            disabled={loading || !link.trim()}
                            onClick={() => {
                                setLoading(true);
                                fetch(
                                    `${
                                        window.location.protocol
                                    }//${host}/proxy/info?url=${encodeURIComponent(
                                        link,
                                    )}`,
                                )
                                    .then((res) => res.json())
                                    .catch((err) => null)
                                    .then((ogData) => {
                                        setLoading(false);
                                        setData(ogData);
                                    });
                            }}
                        >
                            Fetch data
                        </Button>
                    </Grid>
                </Grid>
                {JSON.stringify(data)}
                <Grid item>
                    <Button
                        color="primary"
                        variant="contained"
                        disabled={!link.trim()}
                        onClick={() => {
                            onAdd(link, data);
                        }}
                    >
                        Add
                    </Button>
                </Grid>
            </Grid>
        </React.Fragment>
    );
};

export default Adder;
