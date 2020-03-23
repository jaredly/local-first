// @flow
import type { Content, CRDT, Node } from './types';

export const init = (): CRDT => ({
    largestIDs: {},
    map: {},
    roots: [],
});

// export const inflate = (
//     roots: Array<string>,
//     map: { [key: string]: Node },
// ): CRDT => {
//     const state = {
//         largestIDs: {},
//         map,
//         roots,
//     };
//     Object.keys(map).forEach(k => {
//         const node = map[k];
//         if (!node.id) {
//             throw new Error(`Inflate? ${JSON.stringify(node)}`);
//         }
//         state.largestIDs[node.id[1]] = Math.max(
//             state.largestIDs[node.id[1]] || 0,
//             node.id[0] +
//                 (node.content.type === 'text'
//                     ? node.content.text.length - 1
//                     : 0),
//         );
//     });
//     return state;
// };

export * from './merge';
export * from './deltas';
export * from './apply';
export * from './loc';
export * from './utils';
