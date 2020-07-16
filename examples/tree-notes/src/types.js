// @flow
import * as rich from '../../../packages/rich-text-crdt/';
const blankBody = () => {
    const crdt = rich.init();
    return rich.insert(crdt, ':root:', 0, '\n');
};
export const blankItem = () => ({
    id: '',
    author: '',
    body: blankBody(),
    tags: {},
    createdDate: Date.now(),
    completed: null,
    columnData: {},
    childColumnConfig: null,
    style: 'normal',
    theme: 'list',
    numbering: null,
    trashed: null,
    reactions: {},
});
