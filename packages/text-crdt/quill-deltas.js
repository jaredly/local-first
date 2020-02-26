// @flow
import { localDelete, localInsert, localFormat } from './tree';
import { locToPos, locToInsertionPos, formatAt } from './loc';
import { spansToSelections } from './span';
import type { CRDT, Node, Delta, Span } from './types';

export type QuillDelta<Format> =
    | {| delete: number |}
    | {| insert: string, attributes?: ?Format |}
    | {| retain: number, attributes?: ?Format |};

export const deltaToChange = function<QuillFormat, Format>(
    state: CRDT<Format>,
    delta: Array<QuillDelta<QuillFormat>>,
    transformFormat: (QuillFormat, ?Format, ?Format) => Format,
): Array<Delta<Format>> {
    const changes = [];
    let pos = 0;
    delta.forEach(op => {
        if (op.delete) {
            changes.push(localDelete(state, pos, op.delete));
            pos += op.delete;
        } else if (op.insert) {
            changes.push(
                localInsert(
                    state,
                    pos,
                    op.insert,
                    op.attributes
                        ? transformFormat(
                              op.attributes,
                              formatAt(state, pos - 1),
                              formatAt(state, pos),
                          )
                        : null,
                ),
            );
        } else if (op.retain) {
            if (op.attributes) {
                changes.push(
                    localFormat(
                        state,
                        pos,
                        op.retain,
                        transformFormat(
                            op.attributes,
                            formatAt(state, pos - 1),
                            formatAt(state, pos),
                        ),
                    ),
                );
            }
            pos += op.retain;
        }
    });
    return changes;
};

export const changeToDelta = function<Format, QuillFormat>(
    state: CRDT<Format>,
    change: Delta<Format>,
    convertFormat: Format => QuillFormat,
): Array<QuillDelta<QuillFormat>> {
    switch (change.type) {
        case 'insert':
            const [id, site] = change.span.after;
            const pos = locToInsertionPos(
                state,
                change.span.after,
                change.span.id,
            );
            if (pos === 0) {
                return [{ insert: change.span.text }];
            }
            return [
                { retain: pos },
                {
                    insert: change.span.text,
                    attributes: change.span.format
                        ? convertFormat(change.span.format)
                        : null,
                },
            ];
        case 'format':
            const selections = spansToSelections(state, change.positions);
            let current = 0;
            const res = [];
            const format = convertFormat(change.format);
            selections.forEach(selection => {
                if (selection.start !== current) {
                    res.push({ retain: selection.start - current });
                }
                current = selection.end;
                res.push({
                    retain: selection.end - selection.start,
                    attributes: format,
                });
            });
            return res;
        case 'delete':
            return deleteToDeltas(state, change.positions);
    }
    throw new Error(`Unexpected delta type ${change.type}`);
};

const deleteToDeltas = function<Format, QuillFormat>(
    state: CRDT<Format>,
    positions: Array<Span>,
): Array<QuillDelta<QuillFormat>> {
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
    console.log(res);
    return res;
};
