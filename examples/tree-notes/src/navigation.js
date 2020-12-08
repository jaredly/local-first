// @flow
import { type Collection, type Client } from '../../../packages/client-bundle';
import { blankItem } from './types';

export const nextSibling = (col: Collection<*>, path: Array<string>, id: string) => {
    if (path.length) {
        const pid = path[path.length - 1];
        const parent = col.getCached(pid);
        if (!parent) {
            return null;
        }
        const idx = parent.children.indexOf(id);
        if (idx === -1) {
            return null;
        }
        if (idx === parent.children.length - 1) {
            return nextSibling(col, path.slice(0, -1), pid);
        }
        return parent.children[idx + 1];
    } else {
        return null;
    }
};

export const lastChild = (col: Collection<*>, id: string) => {
    const node = col.getCached(id);
    if (!node) {
        return;
    }
    if (!node.children.length) {
        return id;
    }
    return lastChild(col, node.children[node.children.length - 1]);
};

export const goUp = (col: Collection<*>, path: Array<string>, id: string) => {
    if (!path.length) {
        return;
    }
    const pid = path[path.length - 1];
    const parent = col.getCached(pid);
    if (!parent) {
        return;
    }
    const idx = parent.children.indexOf(id);
    if (idx === -1) {
        return;
    }
    if (idx === 0) {
        return pid;
    }
    return lastChild(col, parent.children[idx - 1]);
};

export const goDown = (col: Collection<*>, path: Array<string>, id: string) => {
    //
    const current = col.getCached(id);
    if (!current) {
        return null;
    }
    if (current.children.length) {
        return current.children[0];
    }
    return nextSibling(col, path, id);
};

export const createAunt = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
) => {
    if (path.length < 2) {
        return;
    }
    const pid = path[path.length - 1];
    const gpid = path[path.length - 2];

    const cid = client.getStamp();
    const item = {
        ...blankItem(),
        id: cid,
    };
    col.save(item.id, item);
    col.insertIdRelative(gpid, ['children'], cid, pid, false);
    return item.id;
};

export const createChild = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
) => {
    const cid = client.getStamp();
    const item = {
        ...blankItem(),
        id: cid,
    };
    col.save(item.id, item);
    col.insertId(id, ['children'], 0, cid);
    return item.id;
};

export const createSibling = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
) => {
    const pid = path[path.length - 1];
    if (!pid) {
        return;
    }
    const cid = client.getStamp();
    const item = {
        ...blankItem(),
        id: cid,
    };
    col.save(item.id, item);
    col.insertIdRelative(pid, ['children'], cid, id, false);
    return item.id;
};
