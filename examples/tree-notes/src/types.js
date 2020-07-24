// @flow
import { type ItemT } from '../collections';
import * as rich from '../../../packages/rich-text-crdt/';
const blankBody = () => {
    const crdt = rich.init();
    return rich.apply(crdt, rich.insert(crdt, ':root:', 0, '\n'));
};
export const blankItem = (): ItemT => ({
    id: '',
    author: '',
    body: blankBody(),
    tags: {},
    createdDate: Date.now(),
    columnData: {},
    childColumnConfig: null,
    style: 'normal',
    theme: 'list',
    numbering: null,
    reactions: {},
    children: [],
});
