// @flow
import { type Collection, type Client } from '../../../packages/client-bundle';
import LocalClient from './LocalClient';
import { blankItem } from './types';

export const nextSibling = (col: Collection<*>, path: Array<string>, id: string, level: number) => {
    if (path.length && level > 0) {
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
            return nextSibling(col, path.slice(0, -1), pid, level - 1);
        }
        return parent.children[idx + 1];
    } else {
        return null;
    }
};

export const lastChild = (local: LocalClient, col: Collection<*>, id: string) => {
    const node = col.getCached(id);
    if (!node) {
        return;
    }
    if (!node.children.length || !local.isExpanded(id)) {
        return id;
    }
    return lastChild(local, col, node.children[node.children.length - 1]);
};

export const goUp = (
    local: LocalClient,
    col: Collection<*>,
    path: Array<string>,
    id: string,
    level: number,
): ?string => {
    if (!path.length || level === 0) {
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
    return lastChild(local, col, parent.children[idx - 1]);
};

export const goDown = (
    local: LocalClient,
    col: Collection<*>,
    path: Array<string>,
    id: string,
    level: number,
) => {
    //
    const current = col.getCached(id);
    if (!current) {
        return null;
    }
    if (current.children.length && (local.isExpanded(id) || level === 0)) {
        return current.children[0];
    }
    return nextSibling(col, path, id, level);
};

export const dedent = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
): ?boolean => {
    if (path.length < 2) {
        return;
    }
    const pid = path[path.length - 1];
    const gpid = path[path.length - 2];
    const parent = col.getCached(pid);
    const gparent = col.getCached(gpid);
    if (!parent || !gparent) {
        return;
    }
    const pidx = gparent.children.indexOf(pid);
    if (pidx === -1) {
        return;
    }
    col.removeId(pid, ['children'], id);
    col.insertIdRelative(gpid, ['children'], id, pid, false);

    return true;
};

export const deleteNode = (col: Collection<*>, path: Array<string>, id: string) => {
    if (!path.length) {
        return;
    }
    const pid = path[path.length - 1];
    col.removeId(pid, ['children'], id);
    col.delete(id);
};

export const removeFromParent = (col: Collection<*>, path: Array<string>, id: string) => {
    if (!path.length) {
        return;
    }
    const pid = path[path.length - 1];
    return col.removeId(pid, ['children'], id);
};

export const indent = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
): ?string => {
    if (!path.length) {
        return;
    }
    const pid = path[path.length - 1];
    const parent = col.getCached(pid);
    if (!parent) {
        return;
    }
    const idx = parent.children.indexOf(id);
    if (idx === -1 || idx === 0) {
        return;
    }
    const newPid = parent.children[idx - 1];
    const newParent = col.getCached(newPid);
    if (!newParent) {
        return;
    }
    col.removeId(pid, ['children'], id);
    if (newParent.children.length) {
        const lastChild = newParent.children[newParent.children.length - 1];
        col.insertIdRelative(newPid, ['children'], id, lastChild, false);
    } else {
        col.insertId(newPid, ['children'], 0, id);
    }

    return newPid;
};

export const createAunt = (
    client: Client<*>,
    col: Collection<*>,
    path: Array<string>,
    id: string,
): ?string => {
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
): string => {
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
): ?string => {
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
