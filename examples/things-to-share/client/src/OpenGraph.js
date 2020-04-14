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

const useStyles = makeStyles((theme) => ({
    //
    root: {
        maxWidth: '100%',
    },
}));

const OpenGraph = ({ data, url }: { data: mixed, url: string }) => {
    const styles = useStyles();

    return (
        <Card className={styles.root}>
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
                title={data['og:title'][0]}
                subheader={
                    <Link
                        color="secondary"
                        rel="noreferrer"
                        target="_blank"
                        href={data['og:url'][0]}
                    >
                        {data['og:url'][0]}
                    </Link>
                }
            />
            {data['og:image'].map((url) => (
                <CardMedia
                    key={url}
                    component="img"
                    // className={classes.media}
                    image={url}
                    title="Image"
                />
            ))}
            <CardContent>
                <Typography variant="h4" color="textSecondary" component="p">
                    {data['og:description'][0]}
                </Typography>
            </CardContent>
            {/* <CardActions disableSpacing>
        <IconButton aria-label="add to favorites">
          <FavoriteIcon />
        </IconButton>
        <IconButton aria-label="share">
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
        </Card>
    );
};

export default OpenGraph;
