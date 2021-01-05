// @flow
import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
// import { type QuillDelta } from '../../../packages/rich-text-crdt/quill-deltas';
import QuillEditor from './Quill';
import { parse, detectLists, detectIngredients } from './parse';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type {
    RecipeMeta,
    RecipeAbout,
    RecipeText,
    RecipeStatus,
    TagT,
    IngredientT,
} from '../collections';
import urlImport from './urlImport';
import { makeStyles } from '@material-ui/core/styles';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Client, Collection } from '../../../packages/client-bundle';
import Delta from 'quill-delta';

import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import Tooltip from './Tooltip';
import { imageUrl } from './utils';

const filter = createFilterOptions();

const useStyles = makeStyles((theme) => ({
    tags: {
        marginBottom: theme.spacing(3),
    },
    container: {
        // display: 'flex',
        // alignItems: 'stretch',
        // flexDirection: 'column',
        marginBottom: 50,
    },
    editorContainer: {
        border: '1px solid currentcolor',
        padding: theme.spacing(1),
    },
    buttons: {
        padding: theme.spacing(2),
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        background: theme.palette.background.default,
    },
}));

const instructionText = (instruction) => {
    if (typeof instruction === 'string') {
        return instruction;
    }
    if (instruction['@type'] === 'HowToStep') {
        return instruction.text;
    }
    // TODO HowToSection maybe
};

// TODO: this will happen automatically on rendering, as we can be pretty sure of its accuracy.
const formatIngredients = (quill, contents, index, length) => {
    let at = 0;
    contents.ops.forEach((item) => {
        if (at >= index + length) {
            return;
        }
        if (item.insert === '\n') {
            at += 1;
            return;
        }
        const lines = item.insert.split('\n');
        if (!lines.length) {
            return;
        }
        lines.forEach((line) => {
            if (at + line.length >= index && at < index + length) {
                parse(line).forEach((found) => {
                    console.log(found);
                    quill.formatText(
                        at + found.offset,
                        found.match.length,
                        'measurement',
                        found.groups,
                        'api',
                    );
                });
            }
            at += line.length + 1;
        });
        at -= 1; // to account for the last \n which is separate
    });
    console.log('ok', contents, index, length);
    // ok, so what are we up to?
    // When formatting as "ingredients"
    // first do the quil line format
    // then find the bounds of all the lines that are ingredients
    // then search those bounds, identifying amounts (incl units) and ingredient names.
};

const makeRecipeDelta = (recipe, allIngredients) => {
    let ovenTemp = null;
    let deltas = [{ insert: recipe.description + '\n\n' }];
    recipe.recipeIngredient.forEach((line) => {
        deltas.push({ insert: line }, { insert: '\n', attributes: { ingredient: true } });
    });
    deltas.push({ insert: '\n' });
    if (typeof recipe.recipeInstructions === 'string') {
        const oven = recipe.recipeInstructions.match(/oven.+?\b(\d{3})°?\b/i);
        if (oven) {
            ovenTemp = oven[1];
        }
        deltas.push(
            { insert: recipe.recipeInstructions },
            { insert: '\n', attributes: { instruction: true } },
        );
    } else if (Array.isArray(recipe.recipeInstructions)) {
        recipe.recipeInstructions.forEach((line) => {
            if (line['@type'] === 'HowToSection') {
                deltas.push(
                    { insert: line.name.trim() },
                    { insert: '\n', attributes: { header: 3 } },
                );
                line.itemListElement.forEach((child) => {
                    const text = instructionText(child);
                    if (text) {
                        const oven = text.match(/oven.+?\b(\d{3})°?\b/i);
                        if (oven) {
                            ovenTemp = oven[1];
                        }
                        deltas.push(
                            { insert: text.trim() },
                            { insert: '\n', attributes: { instruction: true } },
                        );
                    }
                });
                return;
            }
            const text = instructionText(line);
            if (text) {
                const oven = text.match(/oven.+?\b(\d{3})°?\b/i);
                if (oven) {
                    ovenTemp = oven[1];
                }
                console.log(text, oven);
                deltas.push(
                    { insert: text.trim() },
                    { insert: '\n', attributes: { instruction: true } },
                );
            }
        });
    }
    const updates = detectIngredients(deltas, allIngredients);
    updates.forEach((update) => {
        deltas = new Delta(deltas).compose(update).ops;
    });
    return { deltas, ovenTemp };
};

const getImage = (image) => {
    if (!image) {
        return null;
    }
    if (typeof image === 'string') {
        return image;
    }
    if (Array.isArray(image)) {
        return getImage(image[0]);
    }
    if (image['@type'] === 'ImageObject') {
        return image.url;
    }
    return image.url;
};

const statuses: Array<RecipeStatus> = ['to try', 'approved', 'favorite', 'rejected'];

// Ok so what is it that we're editing?
// about: {title, author, source, image}
// contents: {}

export const DeleteButton = ({ onConfirm }: { onConfirm: () => mixed }) => {
    const [really, setReally] = React.useState(false);
    if (really) {
        return (
            <div>
                <Button color="secondary" onClick={() => setReally(false)}>
                    Never mind
                </Button>
                <Button color="primary" onClick={() => onConfirm()}>
                    Really delete?
                </Button>
            </div>
        );
    }
    return (
        <div>
            <Button color="primary" onClick={() => setReally(true)}>
                Delete Recipe
            </Button>
        </div>
    );
};

// const formats = formats => [
//     {format: {bold: true}, title: 'B', selected: formats.bold},
//     {format: {}}
// ]

const RecipeEditor = ({
    about,
    meta,
    text: initialText,
    onSave,
    onCancel,
    onDelete,
    status: initialStatus,
    client,
    tags,
    actorId,
    url,
}: {
    about: RecipeAbout,
    meta: RecipeMeta,
    text: RecipeText,
    status: ?RecipeStatus,
    onSave: (RecipeAbout, RecipeMeta, RecipeText, ?RecipeStatus, Array<string>) => mixed,
    onCancel: () => mixed,
    onDelete?: ?() => mixed,
    client: Client<*>,
    tags: { [key: string]: number },
    actorId: string,
    url: string,
}) => {
    const [ovenTemp, setOvenTemp] = React.useState(meta.ovenTemp ?? '');
    const [cookTime, setCookTime] = React.useState(meta.cookTime ?? '');
    const [prepTime, setPrepTime] = React.useState(meta.prepTime ?? '');
    const [totalTime, setTotalTime] = React.useState(meta.totalTime ?? '');
    const [yieldAmt, setYield] = React.useState(meta.yield ?? '');
    const [image, setImage] = React.useState(about.image ?? '');
    const [title, setTitle] = React.useState(about.title);
    const [source, setSource] = React.useState(about.source);
    const [text, setText] = React.useState(initialText);
    const [status, setStatus] = React.useState(initialStatus);
    const [editTags, setEditTags] = React.useState<Array<{ id: string } | { text: string }>>(
        Object.keys(tags).map((id) => ({ id })),
    );

    const [ingredientsCol, ingredients] = useCollection<IngredientT, _>(
        React,
        client,
        'ingredients',
    );

    const doImport = (source) => {
        urlImport(source).then(
            async (recipe) => {
                console.log('Found!');
                console.log(recipe);
                if (!recipe) {
                    return; // failed tho
                }
                setTitle(recipe.name);
                setYield(recipe.recipeYield);
                const image = getImage(recipe.image);
                if (image) {
                    setImage(image);
                }
                const parseTime = (time) => {
                    const [_, sub] = time.split('T');
                    if (!sub.includes('H')) {
                        return { hours: 0, minutes: +sub.slice(0, -1) };
                    }
                    const [hours, minutes] = sub.split('H');
                    return {
                        hours: +hours,
                        minutes: +minutes.slice(0, -1),
                    };
                };
                const showTime = (time) => {
                    if (time.hours != 0) {
                        return `${time.hours} hours, ${time.minutes} min`;
                    }
                    return `${time.minutes} min`;
                };
                if (recipe.totalTime) {
                    setTotalTime(showTime(parseTime(recipe.totalTime)));
                }
                if (recipe.cookTime) {
                    setCookTime(showTime(parseTime(recipe.cookTime)));
                }
                if (recipe.prepTime) {
                    setPrepTime(showTime(parseTime(recipe.prepTime)));
                }
                const { deltas: contents, ovenTemp } = makeRecipeDelta(
                    recipe,
                    await ingredientsCol.loadAll(),
                );
                if (ovenTemp) {
                    setOvenTemp(ovenTemp);
                }
                if (!(text.ops.length === 1 && text.ops[0].insert === '\n')) {
                    contents.push({ insert: '\n\n----\n\n' });
                    contents.push(...text.ops);
                }
                setText({ ops: contents });
            },
            (err) => console.error(err),
        );
    };

    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const url = params.get('url');
        if (url != null && url !== '') {
            setSource(url);
            doImport(url);
        }
        const text = params.get('text');
        if (text == null || text == '') {
            return;
        }
        const rx = /(((https?:\/\/)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
        const foundUrl = text.match(rx);
        if (foundUrl) {
            setSource(foundUrl[0]);
            doImport(foundUrl[0]);
        }
    }, []);

    const styles = useStyles();

    const [tagsCol, allTags] = useCollection<TagT, _>(React, client, 'tags');

    const quillRef = React.useRef(null);
    const quillRefGet = React.useCallback((node) => {
        quillRef.current = node;
        window.quill = node;
    }, []);
    return (
        <div className={styles.container}>
            <TextField
                value={title}
                onChange={(evt) => setTitle(evt.target.value)}
                label="Title"
                variant="outlined"
                // inputProps={{ style: { width: 80 } }}
                // size="small"
                fullWidth
                style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 16 }}>
                        <TextField
                            value={source}
                            onChange={(evt) => setSource(evt.target.value)}
                            label="Source"
                            variant="outlined"
                            // inputProps={{ style: { width: 80 } }}
                            size="small"
                            fullWidth
                        />
                        <button
                            onClick={() => {
                                doImport(source);
                            }}
                        >
                            Import
                        </button>
                    </div>
                    <TextField
                        value={image}
                        onChange={(evt) => setImage(evt.target.value)}
                        label="Image"
                        variant="outlined"
                        size="small"
                        fullWidth
                    />
                </div>
                {image != '' ? (
                    <img
                        src={imageUrl(image, url)}
                        style={{ width: 100, height: 100, marginLeft: 16, borderRadius: 20 }}
                    />
                ) : null}
            </div>
            <div className={styles.tags}>
                <Autocomplete
                    multiple
                    id="tags-standard"
                    options={Object.keys(allTags).map((k) => allTags[k])}
                    // getOptionLabel={(option) => option.text}
                    selectOnFocus
                    clearOnBlur
                    handleHomeEndKeys
                    renderOption={(option) => option.text}
                    value={
                        editTags
                            .map((t) => (typeof t.id === 'string' ? allTags[t.id] : t))
                            .filter(Boolean)
                        // editTags.filter((t) => !!allTags[t]).map((k) => allTags[k])
                    }
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
            </div>
            <div>
                <TextField
                    value={ovenTemp}
                    onChange={(evt) => setOvenTemp(evt.target.value)}
                    label="Oven Temp"
                    variant="outlined"
                    inputProps={{ style: { width: 80 } }}
                    size="small"
                />
                <TextField
                    value={prepTime}
                    onChange={(evt) => setPrepTime(evt.target.value)}
                    label="Prep time"
                    variant="outlined"
                    inputProps={{ style: { width: 80 } }}
                    size="small"
                />
                <TextField
                    value={cookTime}
                    onChange={(evt) => setCookTime(evt.target.value)}
                    label="Cook time"
                    variant="outlined"
                    inputProps={{ style: { width: 80 } }}
                    size="small"
                />
                <TextField
                    value={totalTime}
                    onChange={(evt) => setTotalTime(evt.target.value)}
                    label="Total time"
                    variant="outlined"
                    inputProps={{ style: { width: 80 } }}
                    size="small"
                />
                <TextField
                    value={yieldAmt}
                    onChange={(evt) => setYield(evt.target.value)}
                    label="Yield"
                    variant="outlined"
                    size="small"
                />
            </div>
            <div style={{ margin: '16px 0' }}>
                {statuses.map((name) => (
                    <Button
                        key={name}
                        variant={status === name ? 'contained' : 'outlined'}
                        color="primary"
                        onClick={() => {
                            if (status === name) {
                                setStatus(null);
                            } else {
                                setStatus(name);
                            }
                        }}
                        style={{ marginRight: 8 }}
                    >
                        {name}
                    </Button>
                ))}
            </div>
            <div>
                <Button
                    onClick={() => {
                        const quill = quillRef.current;
                        if (!quill || !quill.getSelection()) return;
                        const { index, length } = quill.getSelection();
                        if (quill.getFormat().ingredient === true) {
                            quill.formatLine(index, length, 'ingredient', false, 'user');
                            return;
                        }
                        quill.formatLine(index, length, 'ingredient', true, 'user');
                    }}
                >
                    <img
                        src={require('../icons/icon_plain.svg')}
                        style={{ marginRight: 8, display: 'inline-block' }}
                    />
                    Ingredient
                </Button>
                <Button
                    onClick={() => {
                        const quill = quillRef.current;
                        if (!quill || !quill.getSelection()) return;
                        const { index, length } = quill.getSelection();
                        if (quill.getFormat().instruction === true) {
                            quill.formatLine(index, length, 'instruction', false, 'user');
                            return;
                        }
                        quill.formatLine(index, length, 'instruction', true, 'user');
                    }}
                >
                    <img
                        src={require('../icons/knife.svg')}
                        style={{ marginRight: 8, display: 'inline-block' }}
                    />
                    Instruction
                </Button>
                <Button
                    onClick={() => {
                        // const quill = quillRef.current;
                        // if (!quill || !quill.getSelection()) return;
                        // const { index, length } = quill.getSelection();
                        // if (quill.getFormat().instruction === true) {
                        //     quill.formatLine(index, length, 'instruction', false, 'user');
                        //     return;
                        // }
                        // quill.formatLine(index, length, 'instruction', true, 'user');

                        // STOPSHIP: Here's where to start!
                        // go by lines.
                        // For lines that are `ingredient`, go through ingredients to
                        // see if any match the text

                        // STOPSHIP: NEXT UP:
                        // - I want my imported ingredients to be better about plurals and alternate names
                        // - do I do that by hand?
                        // - also, I can import ingredients from that other place.
                        //   looks like it uses "keywords" for alternate names (see chickpeas)
                        // - I probably want to incorporate levenstein distance? maybe? maybe not tho
                        //   maybe just experiment with removing the final "s" from ingredients? idk.
                        // - It's times like these I wish my general server included a "just edit the stuff" frontend.
                        //   Maybe I should make one, that lets you edit the json directly. Doesn't seem like it would
                        //   be too hard.
                        //   On the other hand, building an "ingredient" editor would also be simple, and more useful.
                        //   So, in my ingredient editor, I want to be able to merge ingredients.
                        //   Hm maybe I should add a "mergedInto" field on ingredient? So that I don't have to
                        //   go through all recipes and fix them? Yeah that's a good idea.

                        const quill = quillRef.current;
                        if (!quill) return console.log('no quill');
                        const contents = quill.getContents().ops;
                        const updates = detectIngredients(contents, ingredients);
                        updates.forEach((delta) => {
                            quill.updateContents(delta, 'api');
                        });
                    }}
                >
                    Autodetect ingredients
                </Button>
            </div>
            <div style={{ position: 'relative' }}>
                <QuillEditor
                    className={styles.editorContainer}
                    value={text.ops}
                    onChange={(newValue, change, source) => {
                        setText(newValue);
                        const skip =
                            typeof change.ops[0].retain !== 'undefined' ? change.ops[0].retain : 0;
                        const len = change.length() - skip;
                        // On paste, do some autodetection
                        if (len > 5 && source === 'user') {
                            const quill = quillRef.current;
                            if (!quill) return;
                            console.log('OK', change, len);
                            console.log(skip, change.ops[0]);
                            const text = newValue.ops
                                .map((op) => (typeof op.insert === 'string' ? op.insert : null))
                                .join('')
                                .slice(skip, skip + len);
                            const { ingredients, instructions } = detectLists(text);
                            console.log(ingredients, instructions);
                            ingredients.forEach((index) => {
                                quill.formatLine(skip + index, 0, 'ingredient', true, 'api');
                            });
                            instructions.forEach((index) => {
                                quill.formatLine(skip + index, 0, 'instruction', true, 'api');
                            });
                        }
                    }}
                    actions={null}
                    innerRef={quillRefGet}
                    config={quillConfig}
                />
                {/* {showTooltip ? ( */}
                <Tooltip
                    actorId={actorId}
                    quill={quillRef.current}
                    ingredients={ingredients}
                    ingredientsCol={ingredientsCol}
                />
                {/* ) : null} */}
            </div>
            {onDelete != null ? <DeleteButton onConfirm={onDelete} /> : null}
            <div className={styles.buttons}>
                <Button
                    color="primary"
                    variant="contained"
                    style={{ marginRight: 16 }}
                    onClick={async () => {
                        const tags = [];
                        for (const tag of editTags) {
                            if (typeof tag.id === 'undefined' && typeof tag.text === 'string') {
                                const text = tag.text;
                                const tid = client.getStamp();
                                await tagsCol.save(tid, {
                                    id: tid,
                                    text,
                                    color: null,
                                    created: Date.now(),
                                    authorId: actorId,
                                });
                                tags.push(tid);
                            } else if (typeof tag.id === 'string') {
                                tags.push(tag.id);
                            }
                        }
                        // TODO maybe just use the col here?
                        // Or go through and diff at the top side?
                        onSave(
                            {
                                title,
                                author: about.author,
                                image,
                                source,
                            },
                            {
                                prepTime,
                                ovenTemp,
                                cookTime,
                                totalTime,
                                yield: yieldAmt,
                            },
                            text,
                            status,
                            tags,
                        );
                    }}
                >
                    Save
                </Button>
                <Button
                    onClick={() => {
                        onCancel();
                    }}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
};

const quillConfig = {
    theme: null,
    placeholder: 'Paste or type recipe here...',
    modules: {
        keyboard: {
            bindings: {
                backspace: {
                    key: 8,
                    collapsed: true,
                    handler() {
                        const format = this.quill.getFormat();
                        const sel = this.quill.getSelection();
                        const raw = this.quill.getText();
                        if (raw[sel.index - 1] === '\n' || sel.index === 0) {
                            if (format.instruction) {
                                this.quill.formatLine(sel.index, sel.length, 'instruction', false);
                                return false;
                            }
                            if (format.ingredient) {
                                this.quill.formatLine(sel.index, sel.length, 'ingredient', false);
                                return false;
                            }
                        }
                        return true;
                    },
                },
                enter: {
                    key: 'Enter',
                    collapsed: true,
                    handler() {
                        const format = this.quill.getFormat();
                        const sel = this.quill.getSelection();
                        const raw = this.quill.getText();
                        if (
                            raw[sel.index - 1] === '\n' &&
                            (raw[sel.index] === '\n' || sel.index === raw.length)
                        ) {
                            if (format.instruction) {
                                this.quill.formatLine(sel.index, sel.length, 'instruction', false);
                                return false;
                            }
                            if (format.ingredient) {
                                this.quill.formatLine(sel.index, sel.length, 'ingredient', false);
                                return false;
                            }
                        }
                        return true;
                    },
                },
            },
        },
    },
};

export default RecipeEditor;

// import querystring from 'querystring';
// import ListItem from '@material-ui/core/ListItem';
// import Switch from '@material-ui/core/Switch';
// import FormControlLabel from '@material-ui/core/FormControlLabel';
// import * as React from 'react';
// import {
//     createPersistedBlobClient,
//     createPersistedDeltaClient,
//     createPollingPersistedDeltaClient,
//     createInMemoryDeltaClient,
//     createInMemoryEphemeralClient,
// } from '../../../packages/client-bundle';
// import { useCollection, useItem } from '../../../packages/client-react';
// import type { Data } from '../../shared/auth-api';
// import type { AuthData } from '../../shared/Auth';

// import schemas from '../collections';
// import AppShell from '../../shared/AppShell';
// import Drawer from './Drawer';
// import UpdateSnackbar from '../../shared/Update';
// // import Items from './Items';

// import { Switch as RouteSwitch } from 'react-router-dom';
