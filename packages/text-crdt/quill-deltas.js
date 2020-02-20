// @flow
import { localDelete, localInsert, localFormat } from './tree';
import { locToPos } from './loc';
import { spansToSelections } from './span';
import type { CRDT, Node, Delta, Span } from './types';

type QuillDelta<Format> =
    | {| delete: number |}
    | {| insert: string, attributes?: ?Format |}
    | {| retain: number, attributes?: ?Format |};

export const deltaToChange = function<Format>(
    state: CRDT<Format>,
    delta: Array<QuillDelta<Format>>,
): Array<Delta<Format>> {
    const changes = [];
    let pos = 0;
    delta.forEach(op => {
        if (op.delete) {
            changes.push(localDelete(state, pos, op.delete));
            pos += op.delete;
        } else if (op.insert) {
            changes.push(localInsert(state, pos, op.insert, op.attributes));
        } else if (op.retain) {
            if (op.attributes) {
                changes.push(localFormat(state, pos, op.retain, op.attributes));
            }
            pos += op.retain;
        }
    });
    return changes;
};

export const changeToDelta = function<Format>(
    state: CRDT<Format>,
    change: Delta<Format>,
): Array<QuillDelta<Format>> {
    switch (change.type) {
        case 'insert':
            const [id, site] = change.span.id;
            const pos = locToPos(state, { id, site, pre: false });
            console.log(id, site, pos);
            if (pos === 0) {
                return [{ insert: change.span.text }];
            }
            return [
                { retain: pos },
                {
                    insert: change.span.text,
                    attributes: change.span.format,
                },
            ];
        case 'format':
            const selections = spansToSelections(state, change.positions);
            let current = 0;
            const res = [];
            selections.forEach(selection => {
                if (selection.start !== current) {
                    res.push({ retain: selection.start - current });
                }
                current += selection.end - selection.start;
                res.push({
                    retain: selection.end - selection.start,
                    attributes: change.format,
                });
            });
            return res;
        case 'delete':
            return deleteToDeltas(state, change.positions);
    }
    throw new Error(`Unexpected delta type ${change.type}`);
};

const deleteToDeltas = function<Format>(
    state: CRDT<Format>,
    positions: Array<Span>,
): Array<QuillDelta<Format>> {
    const selections = spansToSelections(state, positions);
    let current = 0;
    const res = [];
    selections.forEach(selection => {
        if (selection.start !== current) {
            res.push({ retain: selection.start - current });
        }
        current += selection.end - selection.start;
        res.push({
            delete: selection.end - selection.start,
        });
    });
    return res;
};
