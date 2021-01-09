// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';

import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import EditIcon from '@material-ui/icons/Edit';
import Star from '@material-ui/icons/Star';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';
import { NewComment, EditComment } from './EditComment';

const useStyles = makeStyles((theme) => ({
    container: {
        fontSize: 20,
        lineHeight: 1.8,
        fontWeight: 300,
        marginBottom: theme.spacing(10),
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

const statuses: Array<RecipeStatus> = ['to try', 'approved', 'favorite', 'rejected'];

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
    const [batches, setBatches] = React.useState(1);
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
            <div style={{ marginTop: 16 }}>
                Batches:
                {/* <span style={{ display: 'inline-block', width: 8 }} /> */}
                {[1, 2, 3].map((num) => (
                    <Button
                        key={num}
                        variant={batches === num ? 'contained' : 'outlined'}
                        style={{ marginLeft: 16 }}
                        onClick={() => {
                            setBatches(num);
                        }}
                    >
                        {num}
                    </Button>
                ))}
            </div>
            <div className={styles.text}>{renderQuill(recipe.contents.text, batches)}</div>
            <Comments url={url} recipe={recipe} col={col} actorId={actorId} />
        </div>
    );
};

const renderStars = (value) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((num) =>
            num <= value ? <Star key={num} /> : <StarOutline key={num} />,
        )}
    </div>
);

const Comment = ({ recipe, col, actorId, comment, url }) => {
    const [editing, setEditing] = React.useState(false);
    return (
        <div
            style={{
                borderBottom: '1px solid white',
                paddingBottom: 16,
                marginBottom: 24,
            }}
        >
            <div style={{ fontSize: '80%', display: 'flex', alignItems: 'center' }}>
                {new Date(comment.date).toLocaleDateString()}
                {editing ? null : (
                    <React.Fragment>
                        <div style={{ width: 16 }} />
                        {renderStars(comment.happiness)}
                        <div style={{ width: 16 }} />
                        {comment.authorId === actorId ? (
                            <IconButton
                                edge="start"
                                color="inherit"
                                onClick={(evt) => {
                                    setEditing(true);
                                }}
                            >
                                <EditIcon />
                            </IconButton>
                        ) : null}
                    </React.Fragment>
                )}
            </div>
            {editing ? (
                <EditComment
                    url={url}
                    comment={comment}
                    onCancel={() => setEditing(false)}
                    onSave={async (text, happiness, images) => {
                        if (!deepEqual(text, comment.text)) {
                            await col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'text'],
                                text,
                            );
                        }
                        if (happiness !== comment.happiness) {
                            await col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'happiness'],
                                happiness,
                            );
                        }
                        if (!deepEqual(images, comment.images)) {
                            await col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'images'],
                                images,
                            );
                        }
                        // TODO images
                        setEditing(false);
                    }}
                />
            ) : (
                <div>
                    {renderQuill(comment.text)}
                    {comment.images.map((image, i) => (
                        <img
                            src={imageUrl(image, url)}
                            style={{
                                width: 200,
                                height: 200,
                                objectFit: 'cover',
                            }}
                            key={i}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const Comments = ({ recipe, col, actorId, url }) => {
    return (
        <div>
            <h3>Comments</h3>
            <NewComment actorId={actorId} recipe={recipe} col={col} />
            <div style={{ height: 36 }} />
            {Object.keys(recipe.comments)
                .sort((a, b) => recipe.comments[b].date - recipe.comments[a].date)
                .map((id) => (
                    <Comment
                        key={id}
                        comment={recipe.comments[id]}
                        url={url}
                        recipe={recipe}
                        col={col}
                        actorId={actorId}
                    />
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
