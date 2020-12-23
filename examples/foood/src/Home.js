// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';

// TODO: list all *tags*, based on stuff.
// Include a url for importing if you want to be fast
// Also a search bar
// Have foood register itself as a share target too.

// Am I ready for bulk import?
// Seems like I might be.

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    tag: {
        width: 120,
        height: 120,
        color: 'inherit',
        // boxShadow: '0 0 2px white',
        border: '1px solid #aaa',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        // borderRadius: 4,
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    recipe: {
        width: 150,
        height: 150,
        color: 'inherit',
        boxShadow: '0 0 2px white',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        borderRadius: 4,
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

const Tag = ({ tag, count }: { tag: TagT, count: number }) => {
    const styles = useStyles();
    return (
        <Link to={'/tag/' + tag.id} className={styles.tag}>
            {tag.text}
            <div className={styles.tagRecipes}>{count} recipes</div>
        </Link>
    );
};

const Home = ({ client }: { client: Client<*> }) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection(React, client, 'recipes');
    const [tagsCol, tags] = useCollection(React, client, 'tags');
    const styles = useStyles();

    const tagCounts = {};
    Object.keys(recipes).forEach((id) => {
        if (!recipes[id].tags) return;
        Object.keys(recipes[id].tags).forEach((tid) => {
            tagCounts[tid] = (tagCounts[tid] || 0) + 1;
        });
    });

    const tagIds = Object.keys(tags).sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));

    if (match.params.tagid) {
        const matches = Object.keys(recipes).filter((id) =>
            recipes[id].tags ? recipes[id].tags[match.params.tagid] != null : false,
        );
        const selectedTag = tags[match.params.tagid];
        if (!selectedTag) {
            return <div>Tag not found</div>;
        }
        return (
            <div>
                <div style={{ display: 'flex', position: 'relative', marginBottom: 8 }}>
                    <Link
                        style={{ position: 'absolute', top: 0, left: 0, color: 'inherit' }}
                        to="/"
                    >
                        Back
                    </Link>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 'bold' }}>
                        {selectedTag.text}
                    </div>
                </div>
                <div className={styles.recipes}>
                    {matches.map((id) => (
                        <Link to={'/recipe/' + id} className={styles.recipe}>
                            {recipes[id].title}
                            {/* {recipes[id].contents.totalTime}
                            {recipes[id].status} */}
                        </Link>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className={styles.tags}>
                {tagIds.map((id) => (
                    <Tag key={id} count={tagCounts[id]} tag={tags[id]} />
                ))}
            </div>
            {/* {Object.keys(recipes).map((id) => (
                <div>
                    {recipes[id].title}
                    {recipes[id].contents.totalTime}
                    {recipes[id].status}
                </div>
            ))} */}
        </div>
    );
};

export default Home;
