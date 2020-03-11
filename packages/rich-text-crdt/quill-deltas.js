// @flow

import deepEqual from 'fast-deep-equal';
import type { CRDT, Node, Delta, Span } from './types';
import { insert, del, format } from './deltas';
import { walkWithFmt } from './debug';
import { apply } from './apply';
import { spansToSelections } from './span';
import { locToPos, locToInsertionPos, formatAt, rootSite } from './loc';
import { toKey, keyEq } from './utils';

type Format = { [key: string]: any };

export type QuillDelta =
    | {| delete: number |}
    | {| insert: string, attributes?: ?Format |}
    | {| retain: number, attributes?: ?Format |};

export const initialQuillDelta = {
    type: 'insert',
    id: [2, rootSite],
    after: [0, rootSite],
    text: '\n',
};

export const stateToQuillContents = (state: CRDT) => {
    const ops = [];
    walkWithFmt(state, (text, fmt) => {
        const attributes = {};
        Object.keys(fmt).forEach(key => {
            if (fmt[key]) {
                attributes[key] = fmt[key];
            }
        });
        const op: { insert: string, attributes?: Format } = { insert: text };
        if (Object.keys(attributes).length) {
            op.attributes = attributes;
        }
        if (
            ops.length &&
            deepEqual(op.attributes, ops[ops.length - 1].attributes)
        ) {
            ops[ops.length - 1].insert += text;
        } else {
            ops.push(op);
        }
    });
    return { ops };
};

export const deltasToQuillDeltas = (
    state: CRDT,
    deltas: Array<Delta | Array<Delta>>,
): { state: CRDT, quillDeltas: Array<Array<QuillDelta>> } => {
    const res = [];
    deltas.forEach(delta => {
        if (Array.isArray(delta)) {
            const inner = deltasToQuillDeltas(state, (delta: any));
            state = inner.state;
            res.push(...inner.quillDeltas);
        } else {
            res.push(deltaToQuillDeltas(state, delta));
            state = apply(state, delta);
        }
    });
    return { state, quillDeltas: res };
};

const deleteToDeltas = function<Format, QuillFormat>(
    state: CRDT,
    positions: Array<Span>,
): Array<QuillDelta> {
    const selections = spansToSelections(state, positions);
    let current = 0;
    const res = [];
    selections.forEach(selection => {
        if (selection.start !== current) {
            res.push({ retain: selection.start - current });
        }
        current = selection.end;
        res.push({
            delete: selection.end - selection.start,
        });
    });
    return res;
};

export const deltaToQuillDeltas = (
    state: CRDT,
    delta: Delta,
): Array<QuillDelta> => {
    console.log('to quill', state, delta);
    if (delta.type === 'insert') {
        const pos = locToInsertionPos(state, delta.after, delta.id);
        const fmt = formatAt(state, delta.after);
        if (pos === 0) {
            return [{ insert: delta.text, attributes: fmt }];
        }
        return [{ retain: pos }, { insert: delta.text, attributes: fmt }];
    } else if (delta.type === 'delete') {
        return deleteToDeltas(state, delta.spans);
    } else if (delta.type === 'format') {
        const startPos = locToPos(state, {
            pre: true,
            id: delta.open.after[0],
            site: delta.open.after[1],
        });
        // Nothing going on here
        if (keyEq(delta.close.after, delta.open.id)) {
            return [];
        }
        const endPos = locToPos(state, {
            pre: true,
            id: delta.close.after[0],
            site: delta.close.after[1],
        });
        const attributes = { [delta.key]: delta.value };
        if (startPos === 0) {
            return [{ retain: endPos, attributes }];
        }
        return [
            { retain: startPos },
            { retain: endPos - startPos, attributes },
        ];
    } else if (delta.type === 'delete-format') {
        const startPos = locToPos(state, {
            pre: true,
            id: delta.open[0],
            site: delta.open[1],
        });
        const endPos = locToPos(state, {
            pre: true,
            id: delta.close[0],
            site: delta.close[1],
        });
        const startNode = state.map[toKey(delta.open)];
        if (!startNode) {
            throw new Error(`Start node not found ${toKey(delta.open)}`);
        }
        if (startNode.content.type !== 'open') {
            throw new Error(
                `Start node not an open type ${toKey(
                    delta.open,
                )} - ${JSON.stringify(startNode.content)}`,
            );
        }
        const attributes = { [startNode.content.key]: null };
        if (startPos === 0) {
            return [{ retain: endPos, attributes }];
        }
        return [
            { retain: startPos },
            { retain: endPos - startPos, attributes },
        ];
    }
    throw new Error(`Unexpected delta type ${delta.type}`);
};

export const quillDeltasToDeltas = (
    state: CRDT,
    quillDeltas: Array<QuillDelta>,
    genStamp: () => string,
): { deltas: Array<Delta>, state: CRDT } => {
    const result = [];
    let at = 0;
    quillDeltas.forEach(quillDelta => {
        if (quillDelta.insert) {
            const changes = insert(
                state,
                at,
                quillDelta.insert,
                quillDelta.attributes || {},
                genStamp,
            );
            state = apply(state, changes);
            result.push(...changes);
            at += quillDelta.insert.length;
        }
        if (quillDelta.retain) {
            // TODO need to be able to delete formatting
            // Or actually quill does this by setting it to null
            // so I think we're fine.
            if (quillDelta.attributes) {
                const attrs = quillDelta.attributes;
                Object.keys(attrs).forEach(key => {
                    const change = format(
                        state,
                        at,
                        quillDelta.retain,
                        key,
                        attrs[key],
                        genStamp(),
                    );
                    state = apply(state, change);
                    result.push(...change);
                });
            }
            at += quillDelta.retain;
        }
        if (quillDelta.delete) {
            const change = del(state, at, quillDelta.delete);
            state = apply(state, change);
            result.push(change);
            // at += quillDelta.delete;
        }
    });
    return { state, deltas: result };
};
