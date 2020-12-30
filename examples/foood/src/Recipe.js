// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';

import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
        fontSize: 20,
        lineHeight: 1.8,
        fontWeight: 300,
    },
    headerImage: {
        width: '100%',
        maxHeight: 300,
        borderRadius: 8,
        objectFit: 'cover',
    },
    title: {
        fontSize: 44,
        lineHeight: 1,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: "'Abril Fatface', cursive",
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 8,
        fontSize: '60%',
    },
    tag: {
        color: 'inherit',
        marginRight: 8,
        padding: 8,
        display: 'inline-block',
        lineHeight: 1,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        textDecoration: 'none',
    },
    text: {
        marginTop: theme.spacing(2),
    },
}));

const formatClass = (format) => {
    if (!format) {
        return null;
    }
    if (format.instruction) {
        return;
    }
};

const useSetTitle = (title) => {
    React.useEffect(() => {
        document.title = title;
    }, [title]);
};

const statuses: Array<RecipeStatus> = ['to try', 'approved', 'rejected'];

const RecipeView = ({
    client,
    actorId,
    url,
    id: overrideId,
}: {
    client: Client<*>,
    actorId: string,
    url: string,
    id?: string,
}) => {
    const match = useRouteMatch();
    const id = overrideId != null ? overrideId : match.params.id;
    const [col, recipe] = useItem<RecipeT, _>(React, client, 'recipes', id);
    const [tagsCol, tags] = useCollection<TagT, _>(React, client, 'tags');
    const [editingTags, setEditingTags] = React.useState(false);
    const styles = useStyles();
    const history = useHistory();
    useSetTitle(recipe ? `${recipe.about.title} | Foood` : 'Foood');
    if (recipe === false) {
        return <div />; // wait on it
    }
    if (!recipe) {
        return <div>Recipe not found</div>;
    }

    const status = recipe.statuses[actorId];

    return (
        <div className={styles.container}>
            {recipe.about.image ? (
                <img src={imageUrl(recipe.about.image, url)} className={styles.headerImage} />
            ) : null}
            <div className={styles.title}>
                {recipe.about.title}
                <IconButton
                    edge="start"
                    style={{ marginRight: 16 }}
                    color="inherit"
                    aria-label="menu"
                    href={`/recipe/${recipe.id}/edit`}
                    onClick={(evt) => {
                        if (evt.button == 0 && !evt.ctrlKey && !evt.metaKey) {
                            history.push(`/recipe/${recipe.id}/edit`);
                            evt.preventDefault();
                            evt.stopPropagation();
                        }
                    }}
                >
                    <EditIcon />
                </IconButton>
            </div>
            <div className={styles.meta}>
                {editingTags ? (
                    <TagsEditor
                        tagsCol={tagsCol}
                        actorId={actorId}
                        recipeId={recipe.id}
                        client={client}
                        tags={recipe.tags}
                        allTags={tags}
                        col={col}
                        onClose={() => setEditingTags(false)}
                    />
                ) : (
                    <div className={styles.tags}>
                        <div style={{ marginRight: 8 }}>Tags:</div>
                        {recipe.tags != null && Object.keys(recipe.tags).length > 0
                            ? Object.keys(recipe.tags)
                                  .filter((tid) => !!tags[tid])
                                  .map((tid) => (
                                      <Link to={`/tag/${tid}`} className={styles.tag} key={tid}>
                                          {tags[tid].text}
                                      </Link>
                                  ))
                            : null}
                        <IconButton
                            edge="start"
                            style={{ marginRight: 16 }}
                            color="inherit"
                            aria-label="menu"
                            onClick={() => {
                                setEditingTags(true);
                            }}
                        >
                            <EditIcon />
                        </IconButton>
                    </div>
                )}
                {renderSource(recipe.about.source)}
                {renderAuthor(recipe.about.author)}
                <span style={{ marginLeft: 16 }}>
                    Updated {new Date(recipe.updatedDate).toLocaleDateString()}
                </span>
            </div>
            <div className={styles.status}>
                {statuses.map((name) => (
                    <Button
                        key={name}
                        variant={status === name ? 'contained' : 'outlined'}
                        color="primary"
                        onClick={async () => {
                            if (status === name) {
                                await col.clearAttribute(recipe.id, ['statuses', actorId]);
                            } else {
                                await col.setAttribute(recipe.id, ['statuses', actorId], name);
                            }
                        }}
                        style={{ marginRight: 8 }}
                    >
                        {name}
                    </Button>
                ))}
            </div>
            <div className={styles.text}>{renderQuill(recipe.contents.text)}</div>
            <Comments recipe={recipe} col={col} />
        </div>
    );
};

const Comments = ({ recipe, col }) => {
    return (
        <div>
            <h3>Comments</h3>
            {Object.keys(recipe.comments)
                .sort((a, b) => recipe.comments[b].date - recipe.comments[a].date)
                .map((id) => (
                    <div
                        key={id}
                        style={{
                            borderBottom: '1px solid white',
                            paddingBottom: 16,
                            marginBottom: 24,
                        }}
                    >
                        <div style={{ fontSize: '80%' }}>
                            {new Date(recipe.comments[id].date).toLocaleDateString()}
                        </div>
                        {renderQuill(recipe.comments[id].text)}
                        {/* {JSON.stringify(recipe.comments[id].text)} */}
                    </div>
                ))}
        </div>
    );
};

const renderAuthor = (author) => {
    if (!author) {
        return null;
    }
    // Imported author, this is a name
    if (author.startsWith(':')) {
        return <span style={{ marginLeft: 16 }}>{author.slice(1)}</span>;
    }
    // STOPSHIP: figure out how I want to deal with multi-user situations.
    // Do I just assume that users on the same server are allowed to see
    // each other's names?
    // And that there will be few enough users that I can just enumerate them?
    return null;
};

const renderSource = (source) => {
    if (!source) {
        return null;
    }
    const match = source.match(/^https?:\/\/(?<host>[^/]+)/);
    if (match && match.groups) {
        return (
            <a rel="noopener noreferrer" target="_blank" href={source}>
                {match.groups.host}
            </a>
        );
    }
    return <span>{source}</span>;
};

export default RecipeView;
