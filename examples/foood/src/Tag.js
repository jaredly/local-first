// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem, useQuery } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Close from '@material-ui/icons/Close';
import LinkIcon from '@material-ui/icons/Link';

import { imageUrl } from './utils';
import Sidebar from './Sidebar';

import RecipeBlock from './RecipeBlock';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },

    mealPlan: {
        padding: 24,
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
    tagRecipes: {
        fontSize: '80%',
    },
}));

const statusOrder = ['favorite', 'approved', 'to try', undefined, null, 'rejected'];

const Tag = ({
    tag,
    count,
    approvedCount,
    recipes,
    matchingRecipes,
    actorId,
    url,
    onClick,
}: {
    approvedCount: number,
    tag: TagT,
    count: number,
    recipes: { [key: string]: RecipeT },
    matchingRecipes: Array<string>,
    actorId: string,
    url: string,
    onClick?: ?() => void,
}) => {
    const styles = useStyles();

    const images = matchingRecipes
        .filter((id) => !!recipes[id].about.image)
        .sort((a, b) => {
            const statusA = statusOrder.indexOf(recipes[a].statuses[actorId]);
            const statusB = statusOrder.indexOf(recipes[b].statuses[actorId]);
            if (statusA === statusB) {
                return recipes[b].updatedDate - recipes[a].updatedDate;
            }
            return statusA - statusB;
        });

    const body = (
        <React.Fragment>
            <div className={styles.tagImages}>
                {images.slice(0, 4).map((id) => (
                    <img
                        key={id}
                        src={imageUrl(recipes[id].about.image, url)}
                        className={
                            images.length === 1
                                ? styles.tagImage1
                                : images.length == 2
                                ? styles.tagImage2
                                : styles.tagImage
                        }
                    />
                ))}
            </div>
            <div className={styles.tagTitle}>
                {tag.text}
                <div className={styles.tagRecipes}>
                    {approvedCount ? `${approvedCount} recipes` : ''}
                    {approvedCount && count > approvedCount ? ', ' : ''}
                    {count > approvedCount ? `${count - approvedCount} pending` : ''}
                </div>
            </div>
        </React.Fragment>
    );

    if (onClick) {
        return (
            <div onClick={onClick} className={styles.tag}>
                {body}
            </div>
        );
    }
    return (
        <Link to={'/tag/' + tag.id} className={styles.tag}>
            {body}
        </Link>
    );
};

export default Tag;
