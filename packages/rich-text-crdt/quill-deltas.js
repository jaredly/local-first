// @flow

import type { CRDT, Node, Delta, Span } from './types';
import { insert, del, format } from './deltas';
import { walkWithFmt } from './debug';

type Format = { [key: string]: any };

export type QuillDelta =
    | {| delete: number |}
    | {| insert: string, attributes?: ?Format |}
    | {| retain: number, attributes?: ?Format |};

export const stateToQuillContents = (state: CRDT) => {
    const ops = [];
    walkWithFmt(state, (text, fmt) => {
        const attributes = {};
        Object.keys(fmt).forEach(key => {
            if (fmt[key]) {
                attributes[key] = fmt[key];
            }
        });
        ops.push({ insert: text, attributes });
    });
    return { ops };
};

export const quillDeltasToDeltas = (
    state: CRDT,
    quillDeltas: Array<QuillDelta>,
    genStamp: () => string,
) => {
    const result = [];
    let at = 0;
    quillDeltas.forEach(quillDelta => {
        if (quillDelta.insert) {
            result.push(
                ...insert(
                    state,
                    at,
                    quillDelta.insert,
                    quillDelta.attributes,
                    genStamp,
                ),
            );
            // at += quillDelta.insert.length
        }
        if (quillDelta.retain) {
            // TODO need to be able to delete formatting
            if (quillDelta.attributes) {
                const attrs = quillDelta.attributes;
                Object.keys(attrs).forEach(key => {
                    result.push(
                        format(
                            state,
                            at,
                            quillDelta.retain,
                            key,
                            attrs[key],
                            genStamp(),
                        ),
                    );
                });
            }
            at += quillDelta.retain;
        }
        if (quillDelta.delete) {
            result.push(del(state, at, quillDelta.delete));
            at += quillDelta.delete;
        }
    });
    return result;
};
