// @flow
import * as React from 'react';

import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import Check from '@material-ui/icons/Check';
import Close from '@material-ui/icons/Close';
import EditIcon from '@material-ui/icons/Edit';

import type { RecipeT, TagT, RecipeStatus } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
const filter = createFilterOptions();

const TagsEditor = ({
    client,
    col,
    tags,
    tagsCol,
    actorId,
    allTags,
    onClose,
    recipeId,
}: {
    client: Client<*>,
    col: Collection<RecipeT>,
    tagsCol: Collection<TagT>,
    actorId: string,
    tags: { [key: string]: number },
    allTags: { [key: string]: TagT },
    onClose: () => mixed,
    recipeId: string,
}) => {
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

                    if (added && (typeof added === 'string' || added.inputValue)) {
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

export default TagsEditor;
