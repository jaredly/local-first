// @flow

import deepEqual from 'fast-deep-equal';
import type { CRDT, Delta, Node, Content } from './types';

import {
    apply,
    insert,
    del,
    format,
    init,
    inflate,
    walk,
    fmtIdx,
    toKey,
    getFormatValues,
} from './';

type Format = { [key: string]: any };

export const walkWithFmt = (state: CRDT, fn: (string, Format) => void) => {
    const format = {};
    const fmt: Format = {};
    walk(state, node => {
        if (node.content.type === 'text') {
            fn(node.content.text, fmt);
        } else if (node.content.type === 'open') {
            const content = node.content;
            if (!format[content.key]) {
                format[content.key] = [content];
            } else {
                const idx = fmtIdx(format[content.key], content);
                // insert into sorted order.
                format[content.key].splice(idx, 0, content);
            }
            fmt[content.key] = format[content.key][0].value;
        } else if (node.content.type === 'close') {
            const content = node.content;
            const f = format[content.key];
            if (!f) {
                console.log('nope at the close', content);
                return;
            }
            const idx = f.findIndex(item => item.stamp === content.stamp);
            if (idx !== -1) {
                f.splice(idx, 1);
            }
            if (f.length) {
                fmt[content.key] = f[0].value;
            } else {
                delete fmt[content.key];
            }
        }
    });
};

export const testSerialize = (state: CRDT, compact: boolean = false) => {
    const res = [];
    walkWithFmt(state, (text, format) => {
        if (
            compact &&
            res.length &&
            deepEqual(res[res.length - 1].fmt, format)
        ) {
            res[res.length - 1].text += text;
        } else {
            res.push({ text, fmt: { ...format } });
        }
    });
    return res;
};

export const justContents = (state: CRDT, includeDeleted: boolean = false) => {
    const res: Array<Content> = [];
    walk(
        state,
        node => {
            res.push(node.content);
        },
        includeDeleted,
    );
    return res;
};
