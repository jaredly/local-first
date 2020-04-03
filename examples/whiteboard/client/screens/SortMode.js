// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from '../Card';
import TagsUI from '../TagsUI';
import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from '../types';

type Comparison = { left: string, right: string, cmp: ?number };

type State = {
    ids: Array<string>,
    compared: { [key: string]: true },
    comparisons: Array<Comparison>,
    current: { left: string, right: string },
};

const topoSort = (ids, comparisons) => {
    const marks = {};
    ids.forEach(id => (marks[id] = true));
    const edges = {};
    const addEdge = (left, right) =>
        edges[left] == null ? (edges[left] = [right]) : edges[left].push(right);
    comparisons.forEach(cmp => {
        if (cmp.cmp != null && cmp.cmp != 0) {
            if (cmp.cmp === -1) {
                addEdge(cmp.left, cmp.right);
            } else {
                addEdge(cmp.right, cmp.left);
            }
        }
    });
    const sorted = [];

    const visit = id => {
        if (marks[id] == null) {
            return;
        }
        if (marks[id] === false) {
            throw new Error(`Cycle!`);
        }
        marks[id] = false;
        if (edges[id]) {
            edges[id].forEach(visit);
        }
        delete marks[id];
        sorted.push(id);
    };

    try {
        while (true) {
            const first = Object.keys(marks)[0];
            if (!first) {
                break;
            }
            visit(first);
        }
    } catch (err) {
        console.log('failed', err, ids, comparisons);
    }
    return sorted;
};

const initialState = (ids): State => ({
    ids,
    comparisons: [],
    compared: {},
    current: { left: ids[0], right: ids[ids.length - 1] },
});

const key = (a, b): string => (a < b ? `${a} ${b}` : `${b} ${a}`);

const findNext = (ids, compared) => {
    for (let i = 0; i < 1000; i++) {
        const a = ids[parseInt(Math.random() * ids.length)];
        const b = ids[parseInt(Math.random() * ids.length)];
        if (a !== b && !compared[key(a, b)]) {
            return { left: a, right: b };
        }
    }
    throw new Error(`No next`);
};

const reduce = (state: State, action) => {
    const compared = {
        ...state.compared,
        [key(action.left, action.right)]: true,
    };
    const next = findNext(state.ids, compared);
    return {
        ...state,
        comparisons: state.comparisons.concat(action),
        compared,
        current: next,
    };
};

const SortMode = ({
    col,
    cards,
    onDone,
    tags,
    scales,
    tagsCol,
    scalesCol,
    genId,
}: {
    onDone: () => void,
    col: Collection<CardT>,
    cards: { [key: string]: CardT },
    tagsCol: Collection<TagT>,
    tags: { [key: string]: TagT },
    scalesCol: Collection<ScaleT>,
    scales: { [key: string]: ScaleT },
    genId: () => string,
}) => {
    const cardIds = React.useMemo(
        () =>
            Object.keys(cards)
                .filter(id => cards[id].header == null)
                .slice(10, 20),
        [],
    );
    const initial = React.useMemo(() => initialState(cardIds), cardIds);
    // const [state, dispatch] = React.useReducer(reducer, initial);
    // console.log('state', state);
    // if (state.sort.type === 'initial') {
    //     return <div>Initial</div>;
    // }
    const [state, dispatch] = React.useReducer(reduce, initial);
    const comparisons = (
        <div>
            {state.comparisons.map((item, i) => (
                <div key={i}>
                    {cards[item.left].title} {item.cmp == null ? '~' : item.cmp < 0 ? '>' : '<'}{' '}
                    {cards[item.right].title}
                </div>
            ))}
        </div>
    );

    // Ok, so let's try another way:
    // accepting that what we have is a partial order (ish)
    // We probably want to set things up so that it's impossible to
    // create a cycle... dunno quite how though

    // Answers might include:
    // - left (is more important)
    // - right (is more important)
    // - down (about the same)
    // - up (I don't know)
    // So down joins the two elements, and up discards the comparison.

    if (!state.current) {
        return <ShowResults cards={cards} comparisons={state.comparisons} ids={state.ids} />;
    }

    const { left, right } = state.current;
    return (
        <div
            css={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
            }}
        >
            <div
                tabIndex="0"
                onKeyDown={evt => {
                    if (evt.key === 'ArrowLeft') {
                        dispatch({ cmp: -1, left, right });
                    } else if (evt.key === 'ArrowRight') {
                        dispatch({ cmp: 1, left, right });
                    } else if (evt.key === 'ArrowUp') {
                        dispatch({ cmp: null, left, right });
                    }
                }}
                css={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    css={styles.button}
                    // left is smaller than right
                    onClick={() => dispatch({ cmp: -1, left, right })}
                >
                    <Card card={cards[left]} />
                </div>
                <div
                    css={styles.button}
                    // right is smaller than left
                    onClick={() => dispatch({ cmp: 1, left, right })}
                >
                    <Card card={cards[right]} />
                </div>
            </div>
            Comparisons:
            {comparisons}
            <ShowResults cards={cards} comparisons={state.comparisons} ids={state.ids} />
        </div>
    );
};

const ShowResults = ({
    comparisons,
    ids,
    cards,
}: {
    comparisons: Array<Comparison>,
    ids: Array<string>,
    cards: { [key: string]: CardT },
}) => {
    const sorted = topoSort(ids, comparisons);
    return (
        <div>
            {sorted.reverse().map(id => (
                <Card card={cards[id]} key={id} />
            ))}
        </div>
    );
};

const styles = {
    button: {
        margin: 24,
        border: '1px solid #ccc',
        cursor: 'pointer',
        padding: '8px 16px',
    },
};

const Card = ({ card }) => {
    return (
        <div css={{ width: 300 }}>
            <strong>{card.title}</strong>
            <div>{card.description}</div>
        </div>
    );
};

export default SortMode;
