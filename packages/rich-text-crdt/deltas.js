// @flow
import deepEqual from 'fast-deep-equal';
import type { Content, CRDT, Node, Delta } from './types';

import { posToLoc, idAfter } from './loc';

// TODO should I accept a formatting thing?
// Yes, because insertion point (e.g. before or after the start of
// a formatting tag) is dependent on what formats I want to exist.
export const insert = (
    state: CRDT,
    at: number,
    text: string,
    format: ?{ [key: string]: any } = null,
) => {
    const loc = posToLoc(state, at, true, format);
    const afterId = idAfter(state, loc);

    state.largestLocalId = Math.max(loc.id, afterId, state.largestLocalId);
    // If currentFormat is missing things, then add new tags.
    // first ID for starting tag, second ID for ending tag,
    // third ID for the text itself, so it's contiguous.
    const nodes = [];
    let currentAfter = [loc.id, loc.site];
    const addNode = content => {
        const id = state.largestLocalId + 1;
        if (content.type === 'text') {
            state.largestLocalId += content.text.length;
        } else {
            state.largestLocalId += 1;
        }
        nodes.push({ after: currentAfter, id: [id, state.site], content });
        currentAfter = [id, state.site];
    };

    // If no format map is provided, take the current format
    if (format) {
        const currentFormat = formatAt(state, loc);
        // Ugh how do I... take care of things?
        // like, actually inserting a closing tag
        // is a bad idea, right?
        // Or wait, maybe it's good?
        // What's the difference between:
        // <open:b:true>ho folks</close:b:true>
        // -> v1
        // <open:b:true>ho<open:b:false>yes</close:b:false> folks</close:b:true>
        // -> v2
        // <open:b:true>ho</close:b:true>yes<open:b:true> folks</close:b:true>
        // Conceptually, I think the second is better.
        // Ok but so what if there's a competing value?
        // <open:h:goog>ho</close:h:goog><open:h:twit>yes</close:h:twit><open:b:goog> folks</close:b:goog>
        // <open:h:goog>ho<open:h:twit>yes</close:h:twit> folks</close:b:goog>
        // The second one is "simpler", includes fewer nodes.
        // but requires resolution of overlapping formats.
        // however, merging will require such resolution, so I'll have to build
        // that anyway.
        // Ok, so if it's a competing value (or a new value), we do a nested tag
        // If it's a missing value, we do the "close & reopen" thing
        Object.keys(currentFormat).forEach(key => {
            if (!(key in format)) {
                addNode({ type: 'close', key, value: currentFormat[key] });
            }
        });
        Object.keys(format).forEach(key => {
            if (!deepEqual(currentFormat[key], format[key])) {
                addNode({ type: 'open', key, value: format[key] });
            }
        });
        addNode({ type: 'text', text });
        Object.keys(format).forEach(key => {
            if (!deepEqual(currentFormat[key], format[key])) {
                addNode({ type: 'close', key, value: format[key] });
            }
        });
        Object.keys(currentFormat).forEach(key => {
            if (!(key in format)) {
                addNode({ type: 'open', key, value: currentFormat[key] });
            }
        });
        // Ok, order of things
        // </close></the></things></that>
        // Ok, so we *should* close our tags in the
        // same order as they're opened, right?
        // Is that something that it makes sense
        // to enforce though? Because we'll have to
        // do some normalize on the flip side I believe.
        // Because merges can easily break that invariant.
    } else {
        addNode({ type: 'text', text });
    }

    // NOTE and interesting case, for posToLoc:
    // if we have <em>Hi</em><strong>folks</strong>
    // at = 2, format = {em: true, strong: true}
    // then we could choose to be within the <em> and
    // add a strong, or we could be within the strong and
    // add an <em>. I'll decide to bias left, and go with
    // the former.

    // Ok, so if we have multiple format things, does it matter
    // which is applied first? I'll assume no.

    return {
        type: 'update',
        insert: nodes,
    };
};

export const del = (state: CRDT, at: number, length: number) => {
    // TODO
};

export const format = (
    state: CRDT,
    at: string,
    length: number,
    key: string,
    value: any,
) => {
    // TODO
};
