// @flow
import * as rich from '../../../packages/rich-text-crdt/';
export const blankItem = () => ({
    id: '',
    author: '',
    body: rich.init(),
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
