// @flow
import * as React from 'react';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client } from '../../../packages/client-bundle';
import { useCollection } from '../../../packages/client-react';
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
    showMoreButton: {
        marginTop: theme.spacing(2),
    },
}));

export const defaultShowAmount = 15;

const statuses: Array<RecipeStatus> = ['to try', 'approved', 'favorite', 'rejected'];

const byUpdatedDate = (recipes, a, b) =>
    recipes[b].updatedDate - recipes[a].updatedDate || a.localeCompare(b);

export const LatestView = ({
    recipes,
    tags,
    actorId,
    showStatusFilters,
    onSelectRecipe,
    url,
}: {
    recipes: { [id: string]: RecipeT },
    tags: { [id: string]: TagT },
    actorId: ?string,
    showStatusFilters: boolean,
    onSelectRecipe?: (id: string) => mixed,
    url: string,
}) => {
    const styles = useStyles();
    const [showUpTo, setShowUpTo] = React.useState(defaultShowAmount);
    const [status, setStatus] = React.useState<?RecipeStatus>(null);

    const ids = Object.keys(recipes)
        .filter(
            (id) =>
                recipes[id].trashedDate == null &&
                (showStatusFilters && actorId != null && status !== null
                    ? recipes[id].statuses[actorId] === status
                    : true),
        )
        .sort((a, b) => byUpdatedDate(recipes, a, b));

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
    }, []);

    return (
        <div className={styles.container}>
            {showStatusFilters && actorId != null ? (
                <div>
                    Filter by:{' '}
                    {statuses.map((name) => (
                        <Button
                            key={name}
                            variant={status === name ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => {
                                setStatus(status === name ? null : name);
                                setShowUpTo(defaultShowAmount);
                            }}
                            style={{ marginRight: 8 }}
                        >
                            {name}
                        </Button>
                    ))}
                </div>
            ) : null}
            {ids.length === 0 ? (
                <div>No recipes found.</div>
            ) : (
                <div className={styles.recipes}>
                    {ids.slice(0, showUpTo).map((id) => (
                        <RecipeBlock
                            url={url}
                            actorId={actorId || ''}
                            recipe={recipes[id]}
                            key={id}
                            tags={tags}
                            onClick={onSelectRecipe != null ? () => onSelectRecipe(id) : undefined}
                        />
                    ))}
                </div>
            )}
            {ids.length > showUpTo ? (
                <Button
                    onClick={() => setShowUpTo(showUpTo + defaultShowAmount)}
                    className={styles.showMoreButton}
                >
                    Show more
                </Button>
            ) : null}
        </div>
    );
};

const Latest = ({
    client,
    actorId,
    url,
    privateClient,
}: {
    url: string,
    client: Client<*>,
    actorId: string,
    privateClient: Client<*>,
}) => {
    const [, recipes] = useCollection<RecipeT, _>(React, client, 'recipes');
    const [, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [sidebar, setSidebar] = React.useState(null);

    useSetTitle('All Recipes | Foood');

    return (
        <React.Fragment>
            <LatestView
                actorId={actorId}
                onSelectRecipe={setSidebar}
                recipes={recipes}
                showStatusFilters={true}
                tags={tags}
                url={url}
            />
            {sidebar != null ? (
                <Sidebar
                    onClose={() => setSidebar(null)}
                    id={sidebar}
                    client={client}
                    privateClient={privateClient}
                    actorId={actorId}
                    url={url}
                />
            ) : null}
        </React.Fragment>
    );
};

export default Latest;
