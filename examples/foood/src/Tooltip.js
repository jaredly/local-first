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
        backgroundColor: 'rgba(255,255,255,0.9)',
        color: 'black',
    },
    formatButton: {
        fontSize: 'inherit',
        // backgroundColor: '#ddd',
        backgroundColor: 'transparent',
        border: '1px solid black',
        cursor: 'pointer',
        // border: 'none',
        borderRadius: 4,
    },
    formatButtonSelected: {
        backgroundColor: 'black',
        color: 'white',
    },
}));

// <Autocomplete
//     multiple
//     id="tags-standard"
//     options={Object.keys(allTags).map((k) => allTags[k])}
//     // getOptionLabel={(option) => option.text}
//     selectOnFocus
//     clearOnBlur
//     handleHomeEndKeys
//     renderOption={(option) => option.text}
//     value={
//         editTags
//             .map((t) => (typeof t.id === 'string' ? allTags[t.id] : t))
//             .filter(Boolean)
//         // editTags.filter((t) => !!allTags[t]).map((k) => allTags[k])
//     }
//     freeSolo
//     filterOptions={(options, params) => {
//         const filtered = filter(options, params);

//         if (params.inputValue !== '') {
//             filtered.push({
//                 inputValue: params.inputValue,
//                 text: `Add "${params.inputValue}"`,
//             });
//         }

//         return filtered;
//     }}
//     getOptionLabel={(option) => {
//         // e.g value selected with enter, right from the input
//         if (typeof option === 'string') {
//             return option;
//         }
//         if (option.inputValue) {
//             return option.inputValue;
//         }
//         return option.text;
//     }}
//     onChange={(event, newValue) => {
//         const added = newValue[newValue.length - 1];

//         if ((added && typeof added === 'string') || added.inputValue) {
//             const text = typeof added === 'string' ? added : added.inputValue;
//             setEditTags(newValue.slice(0, -1).concat({ text }));
//             return;
//         }
//         setEditTags(newValue);
//     }}
//     renderInput={(params) => (
//         <TextField {...params} variant="outlined" label="Tags" placeholder="Tags" />
//     )}
// />

const cx = (...args) => args.filter(Boolean).join(' ');

const Tooltip = ({
    data: { selection, formats, bounds, quill },
    ingredients,
    ingredientsCol,
}: *) => {
    const styles = useStyles();
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
                    {[1, 2, 3].map((h) => (
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
            {JSON.stringify(formats)}
        </div>
    );
};

export default Tooltip;
