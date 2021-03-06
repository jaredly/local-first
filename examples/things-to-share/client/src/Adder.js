// @flow
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import * as React from 'react';
import { animated, useSpring } from 'react-spring';
import useMeasure from 'react-use-measure';
import OpenGraph from './OpenGraph';
import { type TagT } from './types';

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

// const rx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
// const fullRx = /^https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/gi;

const Adder = ({
    onAdd,
    host,
    onCancel,
    initialUrl,
    tags,
}: {
    host: string,
    tags: { [key: string]: TagT },
    onAdd: (string, mixed, Array<string>) => void,
    onCancel?: () => void,
    initialUrl?: string,
}) => {
    const styles = useStyles();

    // const initalUrl = React.useMemo(() => {
    //     const params = window.location.search
    //         .slice(1)
    //         .split('&')
    //         .map((item) => item.split('='))
    //         .reduce(
    //             (col, [k, v]) => (
    //                 (col[k] = v ? decodeURIComponent(v) : v), col
    //             ),
    //             {},
    //         );
    //     if (params.url) {
    //         return params.url;
    //     }
    //     if (params.text) {
    //         const lines = params.text.trim().split('\n');
    //         const lastLine = lines[lines.length - 1].trim();
    //         if (lastLine.match(fullRx)) {
    //             return lastLine;
    //         }
    //         const match = params.text.match(rx);
    //         if (match) {
    //             return match[0];
    //         }
    //     }
    //     return null;
    // }, []);

    const [open, setOpen] = React.useState(initialUrl != null);
    const [ref, { height }] = useMeasure();
    const props = useSpring({
        height,
        config: {
            mass: 1,
            tension: 1000,
            friction: 70,
        },
    });

    return (
        <animated.div
            style={{
                overflow: 'hidden',
                ...props,
            }}
        >
            <Paper className={styles.container} ref={ref}>
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
                                    if (onCancel) {
                                        onCancel();
                                    } else {
                                        setOpen(false);
                                    }
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </div>
                    ) : null}
                    {/* </div> */}
                </div>
                {open ? (
                    <AdderBody
                        initialUrl={initialUrl}
                        host={host}
                        tags={tags}
                        onAdd={(link, data, tags) => {
                            if (!link.trim()) {
                                return; // nope folks
                            }
                            setOpen(false);
                            onAdd(link, data, tags);
                        }}
                    />
                ) : null}
            </Paper>
        </animated.div>
    );
};

const AdderBody = ({
    onAdd,
    host,
    initialUrl,
    tags,
}: {
    host: string,
    onAdd: (string, mixed, Array<string>) => void,
    initialUrl?: string,
    tags: { [key: string]: TagT },
}) => {
    const styles = useStyles();
    const [link, setLink] = React.useState(initialUrl || '');
    const [data, setData] = React.useState(null);
    const [editTags, setEditTags] = React.useState([]);
    // const [tags, setTags] = React.useState({});
    const [loading, setLoading] = React.useState(false);

    // React.useEffect(() => {
    //     const key = '.x_saved_data';
    //     if (data) {
    //         localStorage[key] = JSON.stringify(data);
    //     } else if (localStorage[key]) {
    //         const data = JSON.parse(localStorage[key]);
    //         setData(data);
    //         setLink(data['og:url'][0]);
    //     }
    // }, [data]);

    const mainAction = () => {
        if (data != null) {
            onAdd(link, data, editTags);
        } else if (link.trim() !== '') {
            setLoading(true);
            getData(host, link).then((ogData) => {
                setLoading(false);
                onAdd(link, ogData, editTags);
            });
        }
    };

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
                            autoFocus
                            fullWidth
                            variant="outlined"
                            label="Link"
                            disabled={loading}
                            onChange={(evt) => setLink(evt.target.value)}
                            inputProps={{
                                onKeyDown: (evt) => {
                                    if (evt.key === 'Enter') {
                                        mainAction();
                                    }
                                },
                            }}
                        />
                    </Grid>
                </Grid>
                <Grid item>
                    <Autocomplete
                        multiple
                        id="tags-standard"
                        options={Object.keys(tags).map((k) => tags[k])}
                        getOptionLabel={(option) => option.title}
                        value={editTags.map((k) => tags[k])}
                        disabled={loading}
                        onChange={(_, tags) =>
                            setEditTags(tags.map((tag) => tag.id))
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="standard"
                                label="Tags"
                                placeholder="Tags"
                            />
                        )}
                    />
                </Grid>
                {/* {JSON.stringify(data)} */}
                <Grid item>
                    <Button
                        color="primary"
                        variant="contained"
                        disabled={!link.trim() || loading}
                        onClick={mainAction}
                    >
                        {data ? 'Add' : 'Fetch & Add'}
                    </Button>
                    <Button
                        disabled={loading || !link.trim()}
                        style={{ marginLeft: 12 }}
                        onClick={() => {
                            setLoading(true);
                            getData(host, link).then((ogData) => {
                                setLoading(false);
                                setData(ogData);
                            });
                        }}
                    >
                        Just fetch
                    </Button>
                </Grid>
            </Grid>
        </React.Fragment>
    );
};

export const getData = (host: string, link: string) =>
    fetch(
        `https://get-open-graph.jaredly.workers.dev` +
            // `${
            //     window.location.protocol
            // }//${host}/proxy/info` +
            `?url=${encodeURIComponent(link)}`,
    )
        .then((res) => res.json())
        .catch((err) => null);

export default Adder;
