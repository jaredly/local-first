import type { CRDT, Delta, InsertDelta } from './types';
import { apply, del, init, insert, merge, toKey, walk } from './';
import { stateToQuillContents } from './quill-deltas';

const cloneState = (state: CRDT): CRDT => JSON.parse(JSON.stringify(state));

const applyDeltas = (state: CRDT, deltas: Array<Delta> | Delta): CRDT =>
    apply(state, deltas);

const textOf = (state: CRDT, key: string): string => {
    const content = state.map[key].content;
    if (content.type !== 'text') {
        throw new Error(`${key} is not a text node`);
    }
    return content.text;
};

const visibleTextByWalk = (state: CRDT): string[] => {
    const texts: string[] = [];
    walk(state, node => {
        if (node.content.type === 'text') {
            texts.push(node.content.text);
        }
    });
    return texts;
};

const setupConcurrentDeleteAndInsert = () => {
    let base = init();
    base = applyDeltas(base, insert(base, 'base', 0, 'abcd'));

    let deletingClient = cloneState(base);
    const deleteBc = del(deletingClient, 1, 2);
    deletingClient = applyDeltas(deletingClient, deleteBc);

    let insertingClient = cloneState(base);
    const insertX = insert(insertingClient, 'b', 2, 'X');
    insertingClient = applyDeltas(insertingClient, insertX);

    const xDelta = insertX[0] as InsertDelta;
    const xKey = toKey(xDelta.id);

    return {
        base,
        deletingClient,
        insertingClient,
        deleteBc,
        insertX,
        xKey,
    };
};

describe('bug 1 white-box: insert inside concurrent delete range', () => {
    it.only('documents the split shape that puts the original continuation before the remote insert', () => {
        const { deletingClient, insertingClient, insertX, xKey } = setupConcurrentDeleteAndInsert();

        console.log(JSON.stringify(deletingClient, null, 2))
        console.log(JSON.stringify(insertingClient, null, 2))
        console.log(JSON.stringify(insertX, null, 2))

        const state = applyDeltas(deletingClient, insertX);
        console.log(JSON.stringify(state, null, 2))

        const deletedBKey = toKey([2, 'base']);
        const deletedContinuationKey = toKey([3, 'base']);
        const visibleDKey = toKey([4, 'base']);

        expect(textOf(state, deletedBKey)).toEqual('b');
        expect(state.map[deletedBKey].deleted).toBe(true);
        expect(textOf(state, deletedContinuationKey)).toEqual('c');
        expect(state.map[deletedContinuationKey].deleted).toBe(true);
        expect(textOf(state, visibleDKey)).toEqual('d');
        expect(state.map[visibleDKey].deleted).toBeFalsy();
        expect(textOf(state, xKey)).toEqual('X');

        // Wrong: the original continuation "c" is ordered before the inserted "X".
        // That makes traversal visit "d" before "X" even though "X" was inserted
        // at the boundary between "b" and "c".
        expect(state.map[deletedBKey].children).toEqual([
            deletedContinuationKey,
            xKey,
        ]);
        expect(state.map[deletedContinuationKey].children).toEqual([visibleDKey]);

        // Wrong user-visible result caused by the sibling order above.
        expect(visibleTextByWalk(state)).toEqual(['a', 'd', 'X']);
        expect(stateToQuillContents(state)).toEqual({
            ops: [{ insert: 'adX' }],
        });
    });

    it('documents that merge reconstruction preserves the same erroneous sibling order', () => {
        const { deletingClient, insertingClient, xKey } =
            setupConcurrentDeleteAndInsert();

        const state = merge(deletingClient, insertingClient);

        const deletedBKey = toKey([2, 'base']);
        const deletedContinuationKey = toKey([3, 'base']);
        const visibleDKey = toKey([4, 'base']);

        // Wrong: merge reconstruction preserves the same bad sibling order as
        // incremental apply, so fixing only apply would leave merge inconsistent.
        expect(state.map[deletedBKey].children).toEqual([
            deletedContinuationKey,
            xKey,
        ]);
        expect(state.map[deletedContinuationKey].children).toEqual([visibleDKey]);

        // Wrong user-visible result caused by the reconstructed sibling order.
        expect(visibleTextByWalk(state)).toEqual(['a', 'd', 'X']);
        expect(stateToQuillContents(state)).toEqual({
            ops: [{ insert: 'adX' }],
        });
    });

    it.skip('desired invariant: inserted children should precede the original continuation child', () => {
        const { deletingClient, insertX, xKey } = setupConcurrentDeleteAndInsert();

        const state = applyDeltas(deletingClient, insertX);

        const deletedBKey = toKey([2, 'base']);
        const deletedContinuationKey = toKey([3, 'base']);

        // Desired: inserted children anchored after "b" should come before the
        // original same-site continuation child "c".
        expect(state.map[deletedBKey].children).toEqual([
            xKey,
            deletedContinuationKey,
        ]);
        expect(stateToQuillContents(state)).toEqual({
            ops: [{ insert: 'aXd' }],
        });
    });
});
