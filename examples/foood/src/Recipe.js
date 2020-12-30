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

import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import Check from '@material-ui/icons/Check';
import Close from '@material-ui/icons/Close';
const filter = createFilterOptions();

const TagsEditor = ({ client, col, tags, tagsCol, actorId, allTags, onClose, recipeId }) => {
    const [editTags, setEditTags] = React.useState(Object.keys(tags).map((id) => allTags[id]));

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Autocomplete
                style={{ flex: 1 }}
                multiple
                id="tags-standard"
                options={Object.keys(allTags).map((k) => allTags[k])}
                // getOptionLabel={(option) => option.text}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                renderOption={(option) => option.text}
                value={editTags
                    .map((t) => (typeof t.id === 'string' ? allTags[t.id] : t))
                    .filter(Boolean)}
                freeSolo
                filterOptions={(options, params) => {
                    const filtered = filter(options, params);

                    if (params.inputValue !== '') {
                        filtered.push({
                            inputValue: params.inputValue,
                            text: `Add "${params.inputValue}"`,
                        });
                    }

                    return filtered;
                }}
                getOptionLabel={(option) => {
                    // e.g value selected with enter, right from the input
                    if (typeof option === 'string') {
                        return option;
                    }
                    if (option.inputValue) {
                        return option.inputValue;
                    }
                    return option.text;
                }}
                onChange={(event, newValue) => {
                    const added = newValue[newValue.length - 1];

                    if ((added && typeof added === 'string') || added.inputValue) {
                        const text = typeof added === 'string' ? added : added.inputValue;
                        setEditTags(newValue.slice(0, -1).concat({ text }));
                        return;
                    }
                    setEditTags(newValue);
                }}
                renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="Tags" placeholder="Tags" />
                )}
            />
            <IconButton
                // edge="start"
                // style={{ marginRight: 16 }}
                color="inherit"
                aria-label="menu"
                onClick={async () => {
                    for (const tag of editTags) {
                        if (tag.id != null) {
                            if (tags[tag.id] == null) {
                                await col.setAttribute(recipeId, ['tags', tag.id], Date.now());
                            }
                        } else {
                            const text = tag.text;
                            const tid = client.getStamp();
                            await tagsCol.save(tid, {
                                id: tid,
                                text,
                                color: null,
                                created: Date.now(),
                                authorId: actorId,
                            });
                            await col.setAttribute(recipeId, ['tags', tid], Date.now());
                        }
                    }
                    for (const tid of Object.keys(tags)) {
                        if (!editTags.some((t) => t.id === tid)) {
                            await col.clearAttribute(recipeId, ['tags', tid]);
                        }
                    }
                    onClose();
                }}
            >
                <Check />
            </IconButton>
            <IconButton
                // edge="start"
                // style={{ marginRight: 16 }}
                color="inherit"
                aria-label="menu"
                onClick={() => {
                    onClose();
                }}
            >
                <Close />
            </IconButton>
        </div>
    );
};

const RecipeView = ({
    client,
    actorId,
    url,
}: {
    client: Client<*>,
    actorId: string,
    url: string,
}) => {
    const match = useRouteMatch();
    const { id } = match.params;
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
