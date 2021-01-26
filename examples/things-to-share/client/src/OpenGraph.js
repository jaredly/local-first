// @flow
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
// import IconButton from '@material-ui/core/IconButton';
import CardMedia from '@material-ui/core/CardMedia';
import Link from '@material-ui/core/Link';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import PlayIcon from '@material-ui/icons/PlayCircleFilled';
import * as React from 'react';
import * as he from 'he';

const useStyles = makeStyles((theme) => ({
    //
    nestedRoot: {
        maxWidth: '100%',
        backgroundColor: theme.palette.primary.light,
    },
    root: {
        maxWidth: '100%',
    },
    videoPreview: {
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.palette.primary.dark,
    },
    videoImage: {
        width: '100%',
    },
    playButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closer: {
        cursor: 'pointer',
    },

    images1: {
        marginBottom: 16,
    },
    images2: {
        marginBottom: 16,
        alignItems: 'center',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        backgroundColor: 'black',
    },
    image_0_of_3: {
        gridRow: '1 / 3',
        gridColumn: '1',
    },
    image: {
        maxHeight: '100vh',
        objectFit: 'contain',
    },
}));

const getOgs = (data: mixed, key: string) => {
    // $FlowFixMe
    return data[key] || [];
};

export const getOg = (data: mixed, key: string) => {
    // $FlowFixMe
    if (!data[key]) return null;
    return data[key][0];
};

const VideoPreview = ({ styles, video, url, video_type, image }) => {
    if (video_type !== 'text/html') {
        return <video src={video} controls />;
    }
    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={styles.videoPreview}
        >
            {image ? (
                <img className={styles.videoImage} src={image} />
            ) : (
                <div className={styles.videoPlaceholder} />
            )}
            <div className={styles.playButtonContainer}>
                <PlayIcon
                    style={{
                        fontSize: 48,
                        backgroundColor: 'white',
                        borderRadius: 999,
                    }}
                />
            </div>
        </a>
    );
};

export const searchableFields = (data: mixed) => {
    return {
        type: getOg(data, 'og:type'),
        title: getOg(data, 'og:title'),
        description: getOg(data, 'og:description'),
        site_name: getOg(data, 'og:site_name'),
        url: getOg(data, 'og:url'),
    };
};

export const parseData = (data: mixed) => {
    const type = getOg(data, 'og:type');
    // url = getOg(data, 'og:url') || url;
    const images = getOgs(data, 'og:image');
    // const video = getOg(data, 'og:video:url');
    // const video_type = getOg(data, 'og:video:type');
    const site_name = getOg(data, 'og:site_name');

    const [title, description] =
        site_name === 'Twitter'
            ? [getOg(data, 'og:description'), getOg(data, 'og:title')]
            : [getOg(data, 'og:title'), getOg(data, 'og:description')];

    const hasImage =
        type === 'image' ||
        (type === 'article' &&
            (site_name !== 'Twitter' ||
                getOg(data, 'og:image:user_generated') === 'true'));

    return { site_name, title, description, hasImage };
};

const OpenGraph = ({
    data,
    url,
    nested,
}: {
    data: mixed,
    url: string,
    nested?: boolean,
}) => {
    const styles = useStyles();

    const type = getOg(data, 'og:type');
    url = getOg(data, 'og:url') || url;
    const images = getOgs(data, 'og:image');
    const video = getOg(data, 'og:video:url');
    const video_type = getOg(data, 'og:video:type');
    const site_name = getOg(data, 'og:site_name');
    // for images, need to filter out twitter avatar ones probably

    let [title, description] =
        site_name === 'Twitter'
            ? [getOg(data, 'og:description'), getOg(data, 'og:title')]
            : [getOg(data, 'og:title'), getOg(data, 'og:description')];
    title = title ? he.decode(title) : null;
    description = description ? he.decode(description) : null;

    if (!title && !description) {
        return null;
    }

    return (
        <Card className={nested ? styles.nestedRoot : styles.root}>
            {title ? (
                <CardContent>
                    <Typography
                        style={{ whiteSpace: 'pre-wrap', fontWeight: 300 }}
                        variant="h5"
                        color="textPrimary"
                        component="p"
                    >
                        {title}
                    </Typography>
                </CardContent>
            ) : null}
            {type === 'image' ||
            (type === 'article' &&
                (site_name !== 'Twitter' ||
                    getOg(data, 'og:image:user_generated') === 'true')) ? (
                <div className={styles['images' + Math.min(2, images.length)]}>
                    {images.map((url, i) => (
                        <CardMedia
                            className={
                                styles[`image_${i}_of_${images.length}`] +
                                ' ' +
                                styles.image
                            }
                            key={url}
                            // style={i > 0 ? { marginTop: 12 } : null}
                            component="img"
                            // className={classes.media}
                            image={url}
                            title="Image"
                        />
                    ))}
                </div>
            ) : null}
            {type === 'video' || type === 'video.other' ? (
                <VideoPreview
                    styles={styles}
                    video={video}
                    video_type={video_type}
                    image={images.length ? images[0] : null}
                    url={url}
                />
            ) : null}

            {description ? (
                <CardHeader
                    // avatar={
                    //   <Avatar aria-label="recipe" className={classes.avatar}>
                    //     R
                    //   </Avatar>
                    // }
                    // action={
                    //   <IconButton aria-label="settings">
                    //     {/* <MoreVertIcon /> */}
                    //   </IconButton>
                    // }
                    subheader={
                        <Link
                            rel="noreferrer"
                            target="_blank"
                            href={url}
                            style={{
                                textDecoration: 'underline',
                                color: 'white',
                            }}
                        >
                            {description}
                        </Link>
                    }
                />
            ) : null}
            {/* $FlowFixMe */}
            {data.embedded ? (
                <div style={{ padding: 12, paddingTop: 0 }}>
                    <OpenGraph nested data={data.embedded} url={url} />
                </div>
            ) : null}
        </Card>
    );
};

export default OpenGraph;
