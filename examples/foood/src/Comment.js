// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';

import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import EditIcon from '@material-ui/icons/Edit';
import Star from '@material-ui/icons/Star';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';

import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';
import { NewComment, EditComment } from './EditComment';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import { type Homepage } from '../private-collections';
import type { RecipeT, TagT, RecipeStatus } from '../collections';

const renderStars = (value) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((num) =>
            num <= value ? <Star key={num} /> : <StarOutline key={num} />,
        )}
    </div>
);

const Comment = ({ recipe, editorData, comment, url }: *) => {
    const [editing, setEditing] = React.useState(false);

    const [anchor, setAnchor] = React.useState(null);

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
                {!editorData || editing ? null : (
                    <React.Fragment>
                        <div style={{ width: 16 }} />
                        {renderStars(comment.happiness)}
                        <div style={{ width: 16 }} />
                        {comment.authorId === editorData.actorId ? (
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
            {editorData && editing ? (
                <EditComment
                    url={url}
                    comment={comment}
                    onCancel={() => setEditing(false)}
                    onSave={async (text, happiness, images) => {
                        if (!deepEqual(text, comment.text)) {
                            await editorData.col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'text'],
                                text,
                            );
                        }
                        if (happiness !== comment.happiness) {
                            await editorData.col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'happiness'],
                                happiness,
                            );
                        }
                        if (!deepEqual(images, comment.images)) {
                            await editorData.col.setAttribute(
                                recipe.id,
                                ['comments', comment.id, 'images'],
                                images,
                            );
                        }
                        setEditing(false);
                    }}
                />
            ) : (
                <div>
                    {renderQuill(comment.text)}
                    <div style={{ display: 'flex' }}>
                        {comment.images.map((image, i) => (
                            <div
                                style={{
                                    marginBottom: 16,
                                    marginRight: 16,
                                    position: 'relative',
                                }}
                            >
                                <img
                                    src={imageUrl(image, url)}
                                    style={{
                                        width: 200,
                                        height: 200,
                                        objectFit: 'cover',
                                    }}
                                    key={i}
                                />
                                <IconButton
                                    style={{ position: 'absolute', top: 0, right: 0 }}
                                    color="inherit"
                                    onClick={(evt) => {
                                        setAnchor({ el: evt.currentTarget, src: image });
                                    }}
                                >
                                    <MoreHorizIcon />
                                </IconButton>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {editorData ? (
                <Menu
                    anchorEl={anchor ? anchor.el : null}
                    open={Boolean(anchor)}
                    onClose={() => setAnchor(null)}
                >
                    <MenuItem
                        onClick={() => {
                            if (anchor) {
                                editorData.col.setAttribute(
                                    recipe.id,
                                    ['about', 'image'],
                                    anchor.src,
                                );
                                setAnchor(null);
                            }
                        }}
                    >
                        Use as recipe image
                    </MenuItem>
                </Menu>
            ) : null}
        </div>
    );
};

export default Comment;
