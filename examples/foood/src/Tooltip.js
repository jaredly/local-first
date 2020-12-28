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
                setSelectionData({ selection, formats, bounds });
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
                setSelectionData({ selection, formats, bounds });
                setShow(true);
            });
        }
    }, [quill]);

    const styles = useStyles();

    if (!selectionData) {
        return null;
    }

    const { selection, formats, bounds } = selectionData;

    if (selection.length === 0 && !formats.link && !formats.ingredientLink) {
        return null;
    }

    return (
        <div
            className={styles.formatTooltip}
            onMouseDown={(evt) => {
                evt.stopPropagation();
                evt.preventDefault();
            }}
            style={{
                top: bounds.top + bounds.height + 8,
                left: bounds.left,
                // width: bounds.width,
            }}
        >
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

            <Autocomplete
                id="tags-standard"
                options={Object.keys(ingredients).map((k) => ingredients[k])}
                // getOptionLabel={(option) => option.text}
                selectOnFocus
                clearOnBlur
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{ minWidth: 200 }}
                handleHomeEndKeys
                size="small"
                renderOption={(option) => option.name || 'WAT'}
                value={
                    formats.ingredientLink
                        ? ingredients[formats.ingredientLink]
                        : // : null
                          guessIngredient(ingredients, quill, selection)
                    // null
                }
                // inputValue={
                //     formats.ingredientLink ? '' : quill.getText(selection.index, selection.length)
                // }
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
                    console.log('onchange', newValue, selection);
                    if (!newValue) {
                        return quill.formatText(
                            selection.index,
                            selection.length,
                            'ingredientLink',
                            false,
                        );
                    }
                    if (newValue && (typeof newValue === 'string' || newValue.inputValue)) {
                        // const text = typeof newValue === 'string' ? newValue : newValue.inputValue;
                        // setEditTags(newValue.slice(0, -1).concat({ text }));
                        console.log('need to check with the boss');
                        return;
                    }
                    quill.formatText(
                        selection.index,
                        selection.length,
                        'ingredientLink',
                        newValue.id,
                    );
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
