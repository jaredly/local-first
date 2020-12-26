// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
        fontSize: 20,
        lineHeight: 1.8,
        fontWeight: 300,
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

type Format = 'ingredient' | 'instruction' | { header: number };
const getType = (fmt): ?Format =>
    fmt == null
        ? null
        : fmt.ingredient
        ? 'ingredient'
        : fmt.instruction
        ? 'instruction'
        : fmt.header != null
        ? fmt
        : null;

const renderOps = ({ ops }, styles) => {
    const lines: Array<{ chunks: *, type: ?Format }> = [{ chunks: [], type: null }];
    ops.forEach((op) => {
        if (typeof op.insert !== 'string') {
            // STOPSHIP: handle images and such
            return;
        }
        if (op.insert === '\n') {
            lines[lines.length - 1].type = getType(op.attributes);
            lines.push({ chunks: [], type: null });
        } else {
            const opLines = op.insert.split('\n');
            const first = opLines.shift();
            lines[lines.length - 1].chunks.push({ text: first, format: op.attributes });
            opLines.forEach((text) =>
                lines.push({ chunks: [{ text, format: op.attributes }], type: null }),
            );
        }
    });
    const groups = [];
    lines.forEach((line) => {
        if (!groups.length || groups[groups.length - 1].type !== line.type) {
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
    if (chunk.format.bold) {
        return <strong key={i}>{chunk.text}</strong>;
    }
    if (chunk.format.italic) {
        return <em key={i}>{chunk.text}</em>;
    }
    if (chunk.format.underline) {
        return (
            <span style={{ textDecoration: 'underline' }} key={i}>
                {chunk.text}
            </span>
        );
    }
    if (chunk.format.link) {
        return (
            <a target="_blank" noreferrer noopener key={i} href={chunk.format.link}>
                {chunk.text}
            </a>
        );
    }
    return <span key={i}>{chunk.text}</span>;
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
    if (!type || typeof type.header !== 'number') {
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
    return Plain;
};

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

const RecipeView = ({ client }: { client: Client<*> }) => {
    const match = useRouteMatch();
    const { id } = match.params;
    const [col, recipe] = useItem<RecipeT, _>(React, client, 'recipes', id);
    const [_, tags] = useCollection<TagT, _>(React, client, 'tags');
    const styles = useStyles();
    const history = useHistory();
    useSetTitle(recipe ? `${recipe.about.title} | Foood` : 'Foood');
    if (recipe === false) {
        return <div />; // wait on it
    }
    if (!recipe) {
        return <div>Recipe not found</div>;
    }
    return (
        <div className={styles.container}>
            <div className={styles.title}>
                {recipe.about.title}
                <IconButton
                    edge="start"
                    // className={styles.menuButton}
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
            {recipe.tags != null && Object.keys(recipe.tags).length > 0 ? (
                <div className={styles.tags}>
                    <div style={{ marginRight: 8 }}>Tags:</div>
                    {Object.keys(recipe.tags)
                        .filter((tid) => !!tags[tid])
                        .map((tid) => (
                            <Link to={`/tag/${tid}`} className={styles.tag}>
                                {tags[tid].text}
                            </Link>
                        ))}
                </div>
            ) : null}
            <div className={styles.text}>{renderOps(recipe.contents.text, styles)}</div>
        </div>
    );
};

export default RecipeView;
