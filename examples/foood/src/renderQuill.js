// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import type { RecipeText } from '../collections';

const useStyles = makeStyles((theme) => ({
    instruction: {
        // cursor: 'pointer',
    },

    instructionGroup: {
        padding: 16,
    },
    ingredientGroup: {
        padding: 16,
    },
    ingredient: {
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
    checkedIngredient: {
        textDecoration: 'line-through',
        textDecorationColor: 'rgba(255,255,255,0.3)',
        opacity: 0.8,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
}));

type Format = 'ingredient' | 'instruction' | { header: number } | { list: string } | string;
const getType = (fmt): ?Format => {
    if (!fmt) {
        return null;
    }
    const keys = Object.keys(fmt);
    if (!keys.length) {
        return null;
    }
    if (keys.length > 1) {
        console.error('Multiple keys!');
    }
    const key = keys[0];
    if (fmt[key] === true) {
        return key;
    }
    return fmt;
};

// fmt == null
//     ? null
//     : fmt.ingredient
//     ? 'ingredient'
//     : fmt.instruction
//     ? 'instruction'
//     : fmt.header != null
//     ? fmt
//     : null;

const renderOps = ({ ops }: RecipeText): React.Node => {
    const lines: Array<{ chunks: *, type: ?Format }> = [{ chunks: [], type: null }];
    ops.forEach((op) => {
        if (typeof op.insert !== 'string') {
            // STOPSHIP: handle images and such
            return;
        }
        const attributes = typeof op.attributes === 'object' ? op.attributes : null;
        if (op.insert === '\n') {
            lines[lines.length - 1].type = getType(attributes);
            lines.push({ chunks: [], type: null });
        } else {
            const opLines = op.insert.split('\n');
            const first = opLines.shift();
            lines[lines.length - 1].chunks.push({ text: first, format: attributes });
            opLines.forEach((text) =>
                lines.push({ chunks: [{ text, format: attributes }], type: null }),
            );
        }
    });
    const groups = [];
    lines.forEach((line) => {
        if (
            !groups.length ||
            (line.type != null && !deepEqual(groups[groups.length - 1].type, line.type))
        ) {
            groups.push({ type: line.type, lines: [line] });
        } else {
            groups[groups.length - 1].lines.push(line);
        }
    });
    return groups.map(({ type, lines }, i) => {
        const Container = containerForFormat(type);
        return (
            <Container type={type} key={i}>
                {lines.map((line, i) => {
                    const Comp = componentForFormat(line.type);
                    return (
                        <Comp
                            key={i}
                            type={type}
                            children={line.chunks.map(
                                (chunk, i) => showChunk(chunk, i),
                                // <span>{chunk.text}</span>
                            )}
                        />
                    );
                })}
            </Container>
        );
    });
};

const showChunk = (chunk, i) => {
    // STOPSHIP: handle multiple formats
    if (!chunk.format) {
        return <span key={i}>{chunk.text}</span>;
    }
    const format = chunk.format;
    const keys = Object.keys(format);
    let contents = chunk.text;
    keys.forEach((key) => {
        if (key === 'bold' && format[key]) {
            contents = <strong key={i}>{contents}</strong>;
        }
        if (key === 'italic') {
            contents = <em key={i}>{contents}</em>;
        }
        if (key === 'underline') {
            contents = (
                <span style={{ textDecoration: 'underline' }} key={i}>
                    {contents}
                </span>
            );
        }
        if (key === 'link') {
            contents = (
                <a target="_blank" rel="noreferrer noopener" key={i} href={format[key]}>
                    {contents}
                </a>
            );
        }
        if (key === 'ingredientLink') {
            contents = (
                <span
                    style={{
                        display: 'inline-block',
                        padding: '0 8px',
                        lineHeight: 1.4,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                >
                    {contents}
                </span>
            );
        }
    });
    return contents;
};

const InstructionGroup = ({ children }) => {
    const styles = useStyles();
    return <ol className={styles.instructionGroup}>{children}</ol>;
};

const IngredientGroup = ({ children }) => {
    const styles = useStyles();
    return <div className={styles.instructionGroup}>{children}</div>;
};

const containerForFormat = (format) => {
    if (format === 'instruction') {
        return InstructionGroup;
    }
    if (format === 'ingredient') {
        return IngredientGroup;
    }
    if (format != null) {
        if (format.list === 'ordered') {
            return ({ children }) => <ol>{children}</ol>;
        }
        if (format.list === 'unordered') {
            return ({ children }) => <ul>{children}</ul>;
        }
    }
    return ({ children }) => <div>{children}</div>;
};

const stylesForFormat = (format) => {
    if (typeof format === 'string') {
        return format + 'Group';
    }
    return null;
};

const Plain = ({ children }) => <div style={{ minHeight: '1em' }}>{children}</div>;
const Instruction = ({ children }) => {
    const styles = useStyles();
    return <li className={styles.instruction}>{children}</li>;
};
const Ingredient = ({ children }) => {
    const [checked, setChecked] = React.useState(false);
    const styles = useStyles();
    return (
        <div
            className={checked ? styles.checkedIngredient : styles.ingredient}
            style={{ display: 'flex' }}
            onMouseDown={(_) => setChecked(!checked)}
        >
            {/* <img
            src={require('../icons/icon_plain.svg')}
            style={{ marginRight: 8, marginBottom: -3 }} */}
            <input
                checked={checked}
                onChange={(_) => {}}
                type="checkbox"
                style={{ marginRight: 8, position: 'relative', top: 8 }}
            />
            <div style={{ flex: 1 }}>{children}</div>
        </div>
    );
};

const Header = ({ children, type }) => {
    if (type == null || typeof type.header !== 'number') {
        return <div>{children}</div>;
    }
    if (type.header === 1) {
        return <h1>{children}</h1>;
    }
    if (type.header === 2) {
        return <h2>{children}</h2>;
    }
    if (type.header === 3) {
        return <h3>{children}</h3>;
    }
    return <h4>{children}</h4>;
};

const componentForFormat = (format: ?Format) => {
    if (format == null) {
        return Plain;
    }
    if (format === 'instruction') {
        return Instruction;
    }
    if (format === 'ingredient') {
        return Ingredient;
    }
    if (typeof format.header === 'number') {
        return Header;
    }
    if (typeof format.list === 'string') {
        return ({ children }) => <li>{children}</li>;
    }
    return Plain;
};

export default renderOps;
