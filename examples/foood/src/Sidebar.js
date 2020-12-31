// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import LinkIcon from '@material-ui/icons/Link';

import { imageUrl } from './utils';
import Recipe from './Recipe';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },

    popoverBackground: {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    popoverCloser: {
        position: 'fixed',
        top: 65,
        right: 700,
        display: 'flex',
        flexDirection: 'column',
    },
    popover: {
        position: 'fixed',
        top: 65,
        right: 0,
        bottom: 0,
        width: 700,
        overflow: 'auto',
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
    },

    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    tag: {
        width: 200,
        height: 200,
        color: 'inherit',
        // boxShadow: '0 0 2px white',
        // border: '1px solid #aaa',
        backgroundColor: '#555',
        // padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        position: 'relative',
        '@media(max-width: 600px)': {
            width: '100%',
            height: '100px',
            overflow: 'hidden',
        },
        // borderRadius: 4,
    },
    tagTitle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        fontSize: 20,
        right: 0,
        backgroundColor: 'rgba(50, 50, 50, 0.8)',
        padding: theme.spacing(1),
    },
    tagImages: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
        // height: 100,
        // width: 100,
    },
    tagImage1: {
        margin: 0,
        width: 200,
        height: 200,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            width: '100%',
            height: '100%',
        },
    },
    tagImage2: {
        margin: 0,
        width: 100,
        height: 200,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            width: '50%',
            height: '100%',
        },
    },
    tagImage: {
        margin: 0,
        width: 100,
        height: 100,
        objectFit: 'cover',
        '@media(max-width: 600px)': {
            flex: 1,
            height: '100%',
        },
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    recipe: {
        position: 'relative',
        width: 270,
        height: 200,
        color: 'inherit',
        margin: theme.spacing(1),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        backgroundColor: 'rgb(100,100,100)',
        // borderRadius: 4,
    },
    'to-tryRecipe': {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.secondary.light}`,
    },
    approvedRecipe: {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.primary.light}`,
        // border: `${theme.spacing(1)}px solid ${theme.palette.primary.light}`,
    },
    // recipeWithoutImage: {
    //     padding: 16,
    // },
    // recipeWithImage: {
    //     // position: 'relative',
    //     // backgroundColor: 'rgb(100,100,100)',
    //     // width: 300,
    //     // height: 200,
    //     // color: 'inherit',
    //     // margin: 2,
    //     // display: 'flex',
    //     // flexDirection: 'column',
    //     // justifyContent: 'space-between',
    //     // textDecoration: 'none',
    // },
    recipeImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    recipeTitle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(50,50,50,0.7)',
        padding: theme.spacing(1),
    },
    approvedRecipeTitle: {
        // backgroundColor: theme.palette.primary.dark,
        // color: theme.palette.primary.lighdarkt,
        // textDecorationColor: theme.palette.primary.light,
        // textDecoration: 'underline',
    },
    rejectedRecipeTitle: {
        fontStyle: 'italic',
        textDecoration: 'line-through',
        textDecorationColor: theme.palette.secondary.light,
    },
    tagRecipes: {
        fontSize: '80%',
    },
    // root: {
    //     backgroundColor: theme.palette.background.paper,
    //     overflow: 'hidden',
    // },
    // body: {
    //     padding: theme.spacing(2),
    // },
    // topBar: {
    //     padding: theme.spacing(2),
    //     backgroundColor: theme.palette.primary.light,
    //     color: theme.palette.primary.contrastText,
    // },
}));

const Sidebar = ({
    client,
    id,
    actorId,
    url,
    onClose,
}: {
    client: Client<*>,
    id: string,
    actorId: string,
    url: string,
    onClose: () => mixed,
}) => {
    const history = useHistory();
    const styles = useStyles();
    return (
        <React.Fragment>
            <div className={styles.popoverBackground} onClick={() => onClose()} />
            <div className={styles.popoverCloser}>
                <IconButton color="inherit" aria-label="close sidebar" onClick={(evt) => onClose()}>
                    <Close />
                </IconButton>
                <IconButton
                    color="inherit"
                    href={`/recipe/${id}`}
                    aria-label="go to recipe permalink"
                    onClick={(evt) => {
                        if (evt.button === 0 && !evt.metaKey && !evt.ctrlKey) {
                            history.push(`/recipe/${id}`);
                        }
                    }}
                >
                    <LinkIcon />
                </IconButton>
            </div>
            <div className={styles.popover}>
                <Recipe client={client} actorId={actorId} url={url} id={id} />
            </div>
        </React.Fragment>
    );
};

export default Sidebar;
