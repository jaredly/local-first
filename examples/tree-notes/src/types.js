// @flow
import { type ItemT } from '../collections';
import * as rich from '../../../packages/rich-text-crdt/';
const blankBody = (text) => {
    const crdt = rich.init();
    return rich.apply(crdt, rich.insert(crdt, ':root:', 0, text + '\n'));
};
export const blankItem = (text: string = ''): ItemT => ({
    id: '',
    author: '',
    body: blankBody(text),
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
