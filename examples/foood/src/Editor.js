// @flow
import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
import QuillEditor from './Quill';
import { parse, detectLists } from './parse';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import type { RecipeContents, RecipeT } from '../collections';
import urlImport from './urlImport';

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

const makeRecipeDelta = (recipe) => {
    let ovenTemp = null;
    const deltas = [{ insert: recipe.description + '\n\n' }];
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
        return image[0];
    }
    if (image['@type'] === 'ImageObject') {
        return image.url;
    }
    return image.url;
};

const statuses = ['imported', 'untried', 'approved', 'rejected'];

const RecipeEditor = ({ recipe, onSave }: { recipe: RecipeT, onSave: (RecipeT) => void }) => {
    const [ovenTemp, setOvenTemp] = React.useState(recipe.contents.ovenTemp ?? '');
    const [cookTime, setCookTime] = React.useState(recipe.contents.cookTime ?? '');
    const [prepTime, setPrepTime] = React.useState(recipe.contents.prepTime ?? '');
    const [totalTime, setTotalTime] = React.useState(recipe.contents.totalTime ?? '');
    const [yieldAmt, setYield] = React.useState(recipe.contents.yield ?? '');
    const [image, setImage] = React.useState(recipe.image ?? '');
    const [text, setText] = React.useState(recipe.contents.text);
    const [title, setTitle] = React.useState(recipe.title);
    const [source, setSource] = React.useState(recipe.source);
    const [status, setStatus] = React.useState(recipe.status);

    const quillRef = React.useRef(null);
    const quillRefGet = React.useCallback((node) => {
        quillRef.current = node;
        window.quill = node;
    }, []);
    return (
        <div>
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
                                urlImport(source).then(
                                    (recipe) => {
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
                                        );
                                        if (ovenTemp) {
                                            setOvenTemp(ovenTemp);
                                        }
                                        setText(contents.concat(text));
                                    },
                                    (err) => console.error(err),
                                );
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
                        src={image}
                        style={{ width: 100, height: 100, marginLeft: 16, borderRadius: 20 }}
                    />
                ) : null}
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
                            setStatus(name);
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
                        if (!quill) return;
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
                        if (!quill) return;
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
            </div>
            <QuillEditor
                value={text}
                onChange={(newValue, change, source) => {
                    setText(newValue.ops);
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
            {/* <textarea
                value={JSON.stringify(text, null, 2)}
                onChange={(evt) => {
                    setText(JSON.parse(evt.target.value));
                }}
            /> */}
            <div>
                <Button
                    onClick={() => {
                        onSave({
                            id: Math.random().toString(36).slice(2),
                            createdDate: Date.now(),
                            updatedDate: Date.now(),
                            image,
                            title,
                            source,
                            status,
                            contents: {
                                changeLog: [],
                                version: Math.random().toString(36).slice(2),
                                prepTime,
                                ovenTemp,
                                cookTime,
                                totalTime,
                                yield: yieldAmt,
                                text,
                            },
                            comments: {},
                            author: '',
                            tags: {},
                        });
                    }}
                >
                    Save
                </Button>
                <Button onClick={() => {}}>Cancel</Button>
            </div>
        </div>
    );
};

const quillConfig = {
    theme: 'snow',
    placeholder: 'Paste or type recipe here...',
    modules: {
        // toolbar: [['bold', 'italic', 'underline', 'strike', 'link'], [{ list: 'bullet' }]],
        tookbar: false,
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
