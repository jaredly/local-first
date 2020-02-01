// @flow

import type { Client, Collection } from '../types';
import type { Persistence, Network, ClockPersist } from './types';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as hlc from '@local-first/hybrid-logical-clock';
import deepEqual from 'fast-deep-equal';

type CollectionState<Data, T> = {
    cache: { [key: string]: Data },
    listeners: Array<(Array<{ id: string, value: ?T }>) => mixed>,
    itemListeners: { [key: string]: Array<(?T) => mixed> },
};

const newCollection = () => ({
    cache: {},
    listeners: [],
    itemListeners: {},
});

const setDeep = (obj: any, path, value) => {
    if (!obj) {
        return false;
    }
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
        cur = cur[path[i]];
        if (!cur) {
            return false;
        }
    }
    cur[path[path.length - 1]] = value;
    return true;
};

type CRDTImpl<Delta, Data> = {
    value<T>(Data): T,
    delta: {
        set(Array<string>, Data): Delta,
        delete(string): Delta,
        apply(?Data, Delta): Data,
    },
    createValue<T>(T, string): Data,
};

// This is the full version, non-patch I think?
// Ok I believe this also works with the patch version.
const getCollection = function<Delta, Data, T>(
    colid: string,
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    getStamp: () => string,
): Collection<T> {
    const send = (id, value: ?T) => {
        state.listeners.forEach(fn => fn([{ id, value }]));
        if (state.itemListeners[id]) {
            state.itemListeners[id].forEach(fn => fn(value));
        }
    };
    return {
        async save(id: string, node: T) {
            // so the fact that I'm not doing a merge here bothers me a little bit.
            // yup ok that's illegal, buttt not for the purpose of caching actually.
            state.cache[id] = crdt.createValue(node, getStamp());
            send(id, node);
            await persistence.applyDelta(
                colid,
                id,
                crdt.delta.set([], state.cache[id]),
                crdt.delta.apply,
            );
        },
        async setAttribute(id: string, path: Array<string>, value: any) {
            const delta = crdt.delta.set(
                path,
                crdt.createValue(value, getStamp()),
            );
            let plain = null;
            if (state.cache[id]) {
                state.cache[id] = crdt.delta.apply(state.cache[id], delta);
                plain = crdt.value(state.cache[id]);
                send(id, plain);
            }
            const full = await persistence.applyDelta(
                colid,
                id,
                delta,
                crdt.delta.apply,
            );
            state.cache[id] = full;
            const newPlain = crdt.value(full);
            if (!deepEqual(plain, newPlain)) {
                send(id, newPlain);
            }
        },
        async load(id: string) {
            const v = await persistence.load(colid, id);
            if (!v) {
                return null;
            }
            state.cache[id] = v;
            return crdt.value(v);
        },
        async loadAll() {
            const all = await persistence.loadAll(colid);
            const res = {};
            Object.keys(all).forEach(id => {
                state.cache[id] = all[id];
                res[id] = crdt.value(all[id]);
            });
            return res;
        },
        async delete(id: string) {
            delete state.cache[id];
            send(id, null);
            await persistence.applyDelta(
                colid,
                id,
                crdt.delta.delete(getStamp()),
                crdt.delta.apply,
            );
        },
        onChanges(fn: (Array<{ id: string, value: ?T }>) => void) {
            state.listeners.push(fn);
            return () => {
                state.listeners = state.listeners.filter(f => f !== fn);
            };
        },
        onItemChange(id: string, fn: (?T) => void) {
            if (!state.itemListeners[id]) {
                state.itemListeners[id] = [fn];
            } else {
                state.itemListeners[id].push(fn);
            }
            return () => {
                if (!state.itemListeners[id]) {
                    return;
                }
                state.itemListeners[id] = state.itemListeners[id].filter(
                    f => f !== fn,
                );
            };
        },
    };
};

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

// Ok the part where we get very specific
import { type ClientMessage, type ServerMessage } from '../server';
const syncFetch = async function<Delta, Data>(
    url: string,
    sessionId: string,
    getMessages: (
        reconnected: boolean,
    ) => Promise<Array<ClientMessage<Delta, Data>>>,
    onMessages: (Array<ServerMessage<Delta, Data>>) => Promise<mixed>,
) {
    const messages = await getMessages(true);
    console.log('sync:messages', messages);
    // console.log('messages', messages);
    const res = await fetch(`${url}?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
    if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
    }
    const data = await res.json();
    console.log('sync:data', data);
    await onMessages(data);
};

function createClient<Delta, Data, SyncStatus>(
    // Yeah persistence contains the crdt I think...
    crdt: CRDTImpl<Delta, Data>,
    clockPersist: ClockPersist,
    persistence: Persistence,
): Client<SyncStatus> {
    let clock = clockPersist.get(() => hlc.init(genId(), Date.now()));
    const state = {};
    persistence.collections.forEach(id => (state[id] = newCollection()));

    const getStamp = () => {
        clock = hlc.inc(clock, Date.now());
        clockPersist.set(clock);
        return hlc.pack(clock);
    };

    const setClock = (newClock: HLC) => {
        clock = newClock;
        clockPersist.set(clock);
    };

    // hook up network with persistence?
    // like ""
    return {
        getCollection<T>(colid: string) {
            return getCollection(
                colid,
                crdt,
                persistence,
                state.collections[colid],
                getStamp,
            );
        },
        onSyncStatus(fn) {
            network.onSyncStatus(fn);
        },
        getSyncStatus() {
            return network.getSyncStatus();
        },
    };
}
