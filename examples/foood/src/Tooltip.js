// @flow

import * as React from 'react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
// import Quill from 'quill';
// import { type QuillDelta } from '../../../packages/rich-text-crdt/quill-deltas';
import QuillEditor from './Quill';
import { parse, detectLists } from './parse';
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

import InputAdornment from '@material-ui/core/InputAdornment';

import IconButton from '@material-ui/core/IconButton';

import Close from '@material-ui/icons/Close';

import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
const filter = createFilterOptions();

const useStyles = makeStyles((theme) => ({
    formatTooltip: {
        padding: '4px',
        // fontSize: 20,
        position: 'absolute',
        borderRadius: 4,
        zIndex: 1000,
        // backgroundColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'black',
        // color: 'black',
    },
    formatButton: {
        fontSize: 'inherit',
        color: 'inherit',
        // backgroundColor: '#ddd',
        backgroundColor: 'transparent',
        border: '1px solid white',
        cursor: 'pointer',
        // border: 'none',
        borderRadius: 4,
    },
    formatButtonSelected: {
        backgroundColor: 'white',
        color: 'black',
    },
}));

const cx = (...args) => args.filter(Boolean).join(' ');

const guessIngredient = (ingredients, quill, selection) => {
    const text = quill.getText(selection.index, selection.length);
    const needle = text.toLowerCase();
    let best = null;
    Object.keys(ingredients).forEach((id) => {
        if (ingredients[id].name.toLowerCase() === needle) {
            best = ingredients[id];
        } else if (
            ingredients[id].name.toLowerCase().includes(needle) &&
            (!best || best.name.length > ingredients[id].name.length)
        ) {
            best = ingredients[id];
        }
    });
    return best;
};

const expandSelection = (contents, selection) => {
    let x = 0;
    let start = null;
    let end = null;
    contents.ops.some((delta) => {
        if (x < selection.index) {
            if (!delta.attributes || !delta.attributes.ingredientLink) {
                start = null;
            } else if (!start || start.ingredient !== delta.attributes.ingredientLink) {
                start = { x, ingredient: delta.attributes.ingredientLink };
            }
        }
        x += typeof delta.insert === 'string' ? delta.insert.length : 1;
        if (x > selection.index) {
            if (!start) {
                console.log('no ingredient at selection?');
                return true; // to stop the iteration
            }
            if (end == null) {
                end = start.x;
            }
            if (!delta.attributes || delta.attributes.ingredientLink !== start.ingredient) {
                return true;
            }
            end = x;
        }
    });
    console.log('Ok expanded', start, end);
    if (!start || !end) {
        return selection;
    }
    return { index: start.x, length: end - start.x };
};

const Tooltip = ({
    quill,
    // data: { selection, formats, bounds, quill },
    ingredients,
    ingredientsCol,
}: *) => {
    const [selectionData, setSelectionData] = React.useState(null);
    const [show, setShow] = React.useState(false);
    const dataRef = React.useRef(null);
    dataRef.current = selectionData;

    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
        if (quill) {
            quill.on('selection-change', (selection) => {
                if (!selection) {
                    setTimeout(() => {
                        // TODO if we're not focused, then setShow(false)
                    }, 10);
                    return;
                }
                const formats = quill.getFormat(selection.index, selection.length);
                const bounds = quill.getBounds(selection.index, selection.length);
                setSelectionData({
                    selection,
                    formats,
                    bounds,
                    text: quill.getText(selection.index, selection.length),
                });
                setShow(true);
            });
            quill.on('text-change', () => {
                const selection =
                    quill.getSelection() || (dataRef.current ? dataRef.current.selection : null);
                if (!selection) {
                    return;
                }
                const formats = quill.getFormat(selection.index, selection.length);
                const bounds = quill.getBounds(selection.index, selection.length);
                setSelectionData({
                    selection,
                    formats,
                    bounds,
                    text: quill.getText(selection.index, selection.length),
                });
                setShow(true);
            });
        }
    }, [quill]);

    const styles = useStyles();

    if (!selectionData) {
        return null;
    }

    const { selection, formats, bounds, text } = selectionData;

    if (selection.length === 0 && !formats.link && !formats.ingredientLink) {
        return null;
    }

    console.log('RENDER TEXT', text);

    return (
        <div
            className={styles.formatTooltip}
            // onMouseDown={(evt) => {
            //     evt.stopPropagation();
            //     evt.preventDefault();
            // }}
            style={{
                top: bounds.top + bounds.height + 8,
                left: bounds.left,
                // width: bounds.width,
            }}
        >
            {formats.ingredientLink || formats.ingredient ? (
                <IngredientAutofill
                    onClear={() => {
                        const expandedSelection = expandSelection(quill.getContents(), selection);
                        // TODO: expand selection to encompass the whole contained thing please
                        quill.formatText(
                            expandedSelection.index,
                            expandedSelection.length,
                            'ingredientLink',
                            false,
                        );
                    }}
                    ingredients={ingredients}
                    ingredientsCol={ingredientsCol}
                    selectedText={text}
                    selectedId={formats.ingredientLink}
                    onSelect={(ingredientId) => {
                        const expandedSelection = expandSelection(quill.getContents(), selection);
                        quill.formatText(
                            expandedSelection.index,
                            expandedSelection.length,
                            'ingredientLink',
                            ingredientId,
                        );
                    }}
                    onCreate={(text) => {
                        console.log('Not yet implemented sorry');
                    }}
                    onBlur={() => {
                        // ok close out maybe?
                    }}
                    onFocus={() => {
                        // prevent from closing out
                    }}
                />
            ) : null}

            {selection.length > 0 ? (
                <React.Fragment>
                    <button
                        onClick={() => {
                            quill.format('bold', formats.bold ? false : true);
                        }}
                        className={cx(
                            styles.formatButton,
                            formats.bold ? styles.formatButtonSelected : null,
                        )}
                        style={{ fontWeight: 'bold' }}
                    >
                        B
                    </button>
                    <span style={{ display: 'inline-block', width: 4 }} />
                    <button
                        onClick={() => {
                            quill.format('italic', formats.italic ? false : true);
                        }}
                        className={cx(
                            styles.formatButton,
                            formats.italic ? styles.formatButtonSelected : null,
                        )}
                        style={{ fontStyle: 'italic' }}
                    >
                        I
                    </button>
                    <span style={{ display: 'inline-block', width: 4 }} />
                    <button
                        onClick={() => {
                            quill.formatLine(
                                selection.index,
                                selection.length,
                                'ingredient',
                                formats.ingredient ? false : true,
                            );
                        }}
                        className={cx(
                            styles.formatButton,
                            formats.ingredient ? styles.formatButtonSelected : null,
                        )}
                    >
                        <img
                            src={require('../icons/icon_plain.svg')}
                            style={{ width: '1em', height: '1em', marginBottom: -2 }}
                        />
                    </button>
                    <span style={{ display: 'inline-block', width: 4 }} />
                    <button
                        onClick={() => {
                            quill.formatLine(
                                selection.index,
                                selection.length,
                                'instruction',
                                formats.instruction ? false : true,
                            );
                        }}
                        className={cx(
                            styles.formatButton,
                            formats.instruction ? styles.formatButtonSelected : null,
                        )}
                    >
                        <img
                            src={require('../icons/knife.svg')}
                            style={{ width: '1em', height: '1em', marginBottom: -2 }}
                        />
                    </button>
                    {[4, 3, 2, 1].map((h) => (
                        <React.Fragment key={h}>
                            <span style={{ display: 'inline-block', width: 4 }} />
                            <button
                                onClick={() => {
                                    quill.formatLine(
                                        selection.index,
                                        selection.length,
                                        'header',
                                        formats.header === h ? false : h,
                                    );
                                }}
                                className={cx(
                                    styles.formatButton,
                                    formats.header === h ? styles.formatButtonSelected : null,
                                )}
                            >
                                H{h}
                            </button>
                        </React.Fragment>
                    ))}
                    <span style={{ display: 'inline-block', width: 4 }} />
                </React.Fragment>
            ) : null}
        </div>
    );
};

/*

Ok what's the behavior?

# Selecting new text:
- populate the text field with the selected text
- show the popover with the filtered & sorted results
- the user can click one to select it, and make it happen.

# with an ingredient selected:
- maybe we don't even have a text field at that point. just like a pill or something, which you can "x"
- and then you can reselect or something



*/

const IngredientSelected = ({ ingredients, id, onClear }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <div
                style={{
                    flex: 1,
                    backgroundColor: '#555',
                    padding: '8px',
                    borderRadius: 8,
                }}
            >
                {ingredients[id] ? ingredients[id].name : 'Ingredient not found'}
            </div>
            <IconButton
                aria-label="Clear ingredient link"
                onClick={() => onClear()}
                // onMouseDown={handleMouseDownPassword}
            >
                <Close />
            </IconButton>
        </div>
    );
};

const IngredientAutofill = ({
    ingredients,
    ingredientsCol,
    selectedText,
    selectedId,
    onSelect,
    onCreate,
    onClear,
}) => {
    const inputText =
        selectedId && ingredients[selectedId] ? ingredients[selectedId].name : selectedText;

    const [text, setText] = React.useState(inputText);
    const oldSelectedText = React.useRef(inputText);
    // console.log('RENDER', text, selectedText, oldSelectedText.current);
    if (oldSelectedText.current !== inputText) {
        oldSelectedText.current = inputText;
        setText(inputText);
    }

    return (
        <div>
            <Autocomplete
                options={Object.keys(ingredients).map((k) => ingredients[k])}
                // getOptionLabel={(option) => option.text}
                selectOnFocus
                clearOnBlur
                // onFocus={() => setFocused(true)}
                // onBlur={() => setFocused(false)}
                style={{ minWidth: 200 }}
                handleHomeEndKeys
                size="small"
                renderOption={(option) => option.name || 'WAT'}
                value={selectedId ? ingredients[selectedId] : null}
                inputValue={text}
                onInputChange={(evt, value, reason) => {
                    if (reason === 'input') {
                        console.log('I changed I guess', value);

                        setText(value);
                    }
                }}
                freeSolo
                filterOptions={(options, params) => {
                    const filtered = filter(options, params);

                    if (params.inputValue !== '') {
                        filtered.push({
                            inputValue: params.inputValue,
                            name: `Add "${params.inputValue}"`,
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
                    return option.name;
                }}
                onChange={(event, newValue) => {
                    // console.log('onchange', newValue, selection);
                    if (!newValue) {
                        onClear();
                        return;
                        // return quill.formatText(
                        //     selection.index,
                        //     selection.length,
                        //     'ingredientLink',
                        //     false,
                        // );
                    }
                    if (newValue && (typeof newValue === 'string' || newValue.inputValue)) {
                        // const text = typeof newValue === 'string' ? newValue : newValue.inputValue;
                        // setEditTags(newValue.slice(0, -1).concat({ text }));
                        console.log('need to check with the boss');
                        return;
                    }
                    onSelect(newValue.id);
                    // quill.formatText(selection.index, selection.length, 'ingredientLink', newValue.id);
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        variant="outlined"
                        label="Ingredient"
                        placeholder="Ingredient"
                    />
                )}
            />
        </div>
    );
};

export default Tooltip;
