// @flow
import * as React from 'react';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';

import { useSetTitle } from './Home';
import RecipeBlock from './RecipeBlock';
import Sidebar from './Sidebar';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
}));

const defaultShowAmount = 15;

const statuses: Array<RecipeStatus> = ['to try', 'approved', 'favorite', 'rejected'];

const Latest = ({ client, actorId, url }: { url: string, client: Client<*>, actorId: string }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();
    const [showUpTo, setShowUpTo] = React.useState(defaultShowAmount);

    const [status, setStatus] = React.useState(null);
    const [sidebar, setSidebar] = React.useState(null);

    useSetTitle(
        match.params.tagid && tags[match.params.tagid]
            ? `${tags[match.params.tagid].text} | Foood`
            : 'Foood',
    );

    const ids = Object.keys(recipes)
        .filter(
            (id) =>
                recipes[id].trashedDate == null &&
                (status !== null ? recipes[id].statuses[actorId] === status : true),
        )
        .sort((a, b) => recipes[b].updatedDate - recipes[a].updatedDate);

    React.useEffect(() => {
        const listener = () => {
            if (!document.scrollingElement) {
                return;
            }
            if (
                document.scrollingElement.scrollTop >=
                document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight - 50
            ) {
                setShowUpTo((current) => current + defaultShowAmount);
            }
        };
        document.addEventListener('scroll', listener);
        return () => document.removeEventListener('scroll', listener);
    });

    return (
        <div className={styles.container}>
            <div className={styles.status}>
                Filter by:{' '}
                {statuses.map((name) => (
                    <Button
                        key={name}
                        variant={status === name ? 'contained' : 'outlined'}
                        color="primary"
                        onClick={async () => {
                            setStatus(status === name ? null : name);
                        }}
                        style={{ marginRight: 8 }}
                    >
                        {name}
                    </Button>
                ))}
            </div>
            <div className={styles.recipes}>
                {ids.slice(0, showUpTo).map((id) => (
                    <RecipeBlock
                        url={url}
                        actorId={actorId}
                        recipe={recipes[id]}
                        key={id}
                        tags={tags}
                        onClick={() => setSidebar(id)}
                    />
                ))}
            </div>
            {ids.length > showUpTo ? (
                <Button
                    onClick={() => setShowUpTo(showUpTo + defaultShowAmount)}
                    className={styles.showMoreButton}
                >
                    Show more
                </Button>
            ) : null}
            {sidebar != null ? (
                <Sidebar
                    onClose={() => setSidebar(null)}
                    id={sidebar}
                    client={client}
                    actorId={actorId}
                    url={url}
                />
            ) : null}
        </div>
    );
};

export default Latest;
