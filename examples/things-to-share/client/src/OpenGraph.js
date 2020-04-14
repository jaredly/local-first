// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import { makeStyles } from '@material-ui/core/styles';

import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import IconButton from '@material-ui/core/IconButton';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import FavoriteIcon from '@material-ui/icons/Favorite';
import PlayIcon from '@material-ui/icons/PlayCircleFilled';

const useStyles = makeStyles((theme) => ({
    //
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
}));

const getOgs = (data, key: string) => {
    return data[key] || [];
};

const getOg = (data, key: string) => {
    if (!data[key]) return null;
    return data[key][0];
};

const VideoPreview = ({ styles, video, html_url, image, url }) => {
    if (video) {
        return <video src={video} controls />;
    }
    return (
        <a
            href={html_url || url}
            target="_blank"
            referrer
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

const OpenGraph = ({ data, url }: { data: mixed, url: string }) => {
    const styles = useStyles();

    const type = getOg(data, 'og:type');
    const title = getOg(data, 'og:title');
    const description = getOg(data, 'og:description');
    url = getOg(data, 'og:url') || url;
    const images = getOgs(data, 'og:image');
    const video = getOg(data, 'og:video:url');
    const html_url = getOg(data, 'og:video:html_url');
    // for images, need to filter out twitter avatar ones probably

    return (
        <Card className={styles.root}>
            <CardContent>
                <Typography variant="h4" color="textSecondary" component="p">
                    {description}
                </Typography>
            </CardContent>
            {type === 'image'
                ? images.map((url) => (
                      <CardMedia
                          key={url}
                          component="img"
                          // className={classes.media}
                          image={url}
                          title="Image"
                      />
                  ))
                : null}
            {type === 'video' ? (
                <VideoPreview
                    styles={styles}
                    video={video}
                    html_url={html_url}
                    image={images.length ? images[0] : null}
                    url={url}
                />
            ) : // <iframe referrerpolicy="no-referrer" src={video} />
            // <video
            // video ? (
            //     <video
            //         width="640"
            //         height="480"
            //         controls
            //         src={
            //             // 'https://video.twimg.com/tweet_video/EVa58wJUMAAr-2x.mp4'
            //             video
            //             //  video
            //         }
            //     />
            // ) : (
            //     images.map((href) => (
            //         <Link href={html_url ? html_url : url} target="_blank">
            //             <CardMedia
            //                 key={href}
            //                 component="img"
            //                 // className={classes.media}
            //                 image={href}
            //                 title="Image"
            //             />
            //         </Link>
            //     ))
            // )
            null}
            {/* <CardActions disableSpacing>
        <IconButton aria-label="add to favorites">
          PlayIconFavoriteIcon />
        </IconButton>
        <IconButton aria-PlayCircleFilled="share">
          <ShareIcon />
        </IconButton>
        <IconButton
          className={clsx(classes.expand, {
            [classes.expandOpen]: expanded,
          })}
          onClick={handleExpandClick}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardActions> */}
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
                title={title}
                subheader={
                    <Link
                        color="secondary"
                        rel="noreferrer"
                        target="_blank"
                        href={url}
                    >
                        {url}
                    </Link>
                }
            />
        </Card>
    );
};

export default OpenGraph;
