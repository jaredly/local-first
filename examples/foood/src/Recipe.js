// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(8),
    },
    title: {
        fontSize: 24,
        marginBottom: 16,
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    tag: {
        width: 150,
        height: 150,
        color: 'inherit',
        boxShadow: '0 0 2px white',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        borderRadius: 4,
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    recipe: {
        width: 150,
        height: 150,
        color: 'inherit',
        boxShadow: '0 0 2px white',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        borderRadius: 4,
    },
    // root: {
    //     backgroundColor: theme.palette.background.paper,
    //     overflow: 'hidden',
    // },
    // body: {
    //     padding: theme.spacing(2),
    // },
    // topBar: {
    //     padding: theme.spacing(2),
    //     backgroundColor: theme.palette.primary.light,
    //     color: theme.palette.primary.contrastText,
    // },
}));

const renderOps = ({ ops }) => {
    const lines = [{ chunks: [], format: null }];
    ops.forEach((op) => {
        if (op.insert === '\n') {
            lines[lines.length - 1].format = op.attributes;
            lines.push({ chunks: [], format: null });
        } else {
            const opLines = op.insert.split('\n');
            const first = opLines.shift();
            lines[lines.length - 1].chunks.push({ text: first, format: op.attributes });
            opLines.forEach((text) =>
                lines.push({ chunks: [{ text, format: op.attributes }], format: null }),
            );
        }
    });
    return lines.map((line, i) => {
        const Comp = componentForFormat(line.format);
        return (
            <Comp
                key={i}
                children={line.chunks.map((chunk, i) => (
                    <span>{chunk.text}</span>
                ))}
            />
        );
    });
};

const Plain = ({ children }) => <div>{children}</div>;
const Instruction = ({ children }) => <div style={{ color: 'red' }}>{children}</div>;
const Ingredient = ({ children }) => (
    <div style={{ fontWeight: 'bold', display: 'flex' }}>
        {/* <img
            src={require('../icons/icon_plain.svg')}
            style={{ marginRight: 8, marginBottom: -3 }}
        /> */}
        <input type="checkbox" style={{ marginRight: 8 }} />
        <div style={{ flex: 1 }}>{children}</div>
    </div>
);

const componentForFormat = (format) => {
    if (!format) {
        return Plain;
    }
    if (format.instruction) {
        return Instruction;
    }
    if (format.ingredient) {
        return Ingredient;
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

const RecipeView = ({ client }) => {
    const match = useRouteMatch();
    const { id } = match.params;
    const [col, recipe] = useItem(React, client, 'recipes', id);
    const styles = useStyles();
    if (!recipe) {
        return <div>Recipe not found</div>;
    }
    return (
        <div>
            <div className={styles.title}>{recipe.title}</div>
            {/* {JSON.stringify(recipe.contents.text)} */}
            {renderOps(recipe.contents.text)}
        </div>
    );
};

export default RecipeView;
