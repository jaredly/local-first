// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

import { tagStyle, createTagStyle } from '../Card';
import TagsUI from '../TagsUI';
import { type Collection } from '../../../../packages/client-bundle';
import { type CardT, type TagT, type ScaleT, colors } from '../types';

function* mergeSort<T>(unsortedArray: Array<T>) {
    // No need to sort the array if the array only has one element or empty
    if (unsortedArray.length <= 1) {
        return unsortedArray;
    }
    // In order to divide the array in half, we need to figure out the middle
    const middle = Math.floor(unsortedArray.length / 2);

    // This is where we will be dividing the array into left and right
    const left = unsortedArray.slice(0, middle);
    const right = unsortedArray.slice(middle);

    // Using recursion to combine the left and right
    return yield* merge<T>(yield* mergeSort<T>(left), yield* mergeSort<T>(right));
}

function* merge<T>(left: Array<T>, right: Array<T>) {
    let resultArray = [],
        leftIndex = 0,
        rightIndex = 0;

    // We will concatenate values into the resultArray in order
    while (leftIndex < left.length && rightIndex < right.length) {
        const compare = yield { left: left[leftIndex], right: right[rightIndex] };
        if (compare < 0) {
            resultArray.push(left[leftIndex]);
            leftIndex++; // move left array cursor
            // TODO handle "equal"
            // Maybe by merging the two into an array?
        } else {
            resultArray.push(right[rightIndex]);
            rightIndex++; // move right array cursor
        }
    }

    // We need to concat here because there will be one element remaining
    // from either left OR the right
    return resultArray.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

type State = {
    sort: SortState,
    gen: any,
    comparisons: Array<{ left: string, right: string, cmp: number }>,
};

type SortState =
    | {
          type: 'initial',
      }
    | {
          type: 'compare',
          left: string,
          right: string,
      }
    | {
          type: 'finished',
          ids: Array<string>,
      };

const initialState = (ids: Array<string>): State => {
    const gen = mergeSort(ids);
    const res = gen.next().value;
    return { gen, sort: nextSort(res), comparisons: [] };
};

const nextSort = res => {
    if (res.left != null && res.right != null) {
        return { type: 'compare', left: res.left, right: res.right };
    } else {
        return { type: 'finished', ids: res };
    }
};

const reducer = (state: State, action) => {
    if (action.type === 'compare') {
        const res = state.gen.next(action.cmp).value;
        return {
            ...state,
            sort: nextSort(res),
            comparisons: state.comparisons.concat([
                { left: action.left, right: action.right, cmp: action.cmp },
            ]),
        };
    } else {
        return state;
    }
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
    const [state, dispatch] = React.useReducer(reducer, initial);
    console.log('state', state);
    if (state.sort.type === 'initial') {
        return <div>Initial</div>;
    }
    const comparisons = (
        <div>
            {state.comparisons.map((item, i) => (
                <div key={i}>
                    {cards[item.left].title} {item.cmp < 0 ? '>' : '<'} {cards[item.right].title}
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

    if (state.sort.type === 'compare') {
        const { left, right } = state.sort;
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
                            dispatch({ type: 'compare', cmp: -1, left, right });
                        } else if (evt.key === 'ArrowRight') {
                            dispatch({ type: 'compare', cmp: 1, left, right });
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
                        onClick={() => dispatch({ type: 'compare', cmp: -1, left, right })}
                    >
                        <Card card={cards[left]} />
                    </div>
                    <div
                        css={styles.button}
                        // right is smaller than left
                        onClick={() => dispatch({ type: 'compare', cmp: 1, left, right })}
                    >
                        <Card card={cards[right]} />
                    </div>
                </div>
                Comparisons:
                {comparisons}
            </div>
        );
    }
    return (
        <div>
            Sorted:
            {state.sort.ids.map(id => (
                <Card card={cards[id]} key={id} />
            ))}
            Comparisons:
            {comparisons}
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
        <div>
            <strong>{card.title}</strong>
            <div>{card.description}</div>
        </div>
    );
};

export default SortMode;
