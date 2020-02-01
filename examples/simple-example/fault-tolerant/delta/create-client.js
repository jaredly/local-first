// @flow

import type { Client, Collection } from '../types';
import type {
    Persistence,
    Network,
    ClockPersist,
    DeltaPersistence,
    FullPersistence,
} from './types';
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
        stamp(Delta): string,
    },
    createValue<T>(T, string): Data,
};

const send = <Data, T>(
    state: CollectionState<Data, T>,
    id: string,
    value: ?T,
) => {
    state.listeners.forEach(fn => fn([{ id, value }]));
    if (state.itemListeners[id]) {
        state.itemListeners[id].forEach(fn => fn(value));
    }
};

// This is the full version, non-patch I think?
// Ok I believe this also works with the patch version.
const getCollection = function<Delta, Data, T>(
    colid: string,
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    getStamp: () => string,
    setDirty: () => void,
): Collection<T> {
    return {
        async save(id: string, node: T) {
            // so the fact that I'm not doing a merge here bothers me a little bit.
            // yup ok that's illegal, buttt not for the purpose of caching actually.
            state.cache[id] = crdt.createValue(node, getStamp());
            send(state, id, node);
            await persistence.applyDelta(
                colid,
                id,
                crdt.delta.set([], state.cache[id]),
                crdt.delta.apply,
            );
            setDirty();
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
                send(state, id, plain);
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
                send(state, id, newPlain);
            }
            setDirty();
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
            send(state, id, null);
            await persistence.applyDelta(
                colid,
                id,
                crdt.delta.delete(getStamp()),
                crdt.delta.apply,
            );
            setDirty();
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

import { type PeerChange } from '../client';
import { debounce } from '../debounce';
import poller from '../../client/poller';
import backOff from '../../shared/back-off';

const onCrossTabChanges = async function<Delta, Data, T>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    state: CollectionState<Data, T>,
    colid: string,
    nodes: Array<string>,
) {
    const values = {};
    await Promise.all(
        nodes.map(async id => {
            const v = await persistence.load(colid, id);
            if (v) {
                state.cache[id] = v;
                values[id] = crdt.value(v);
            } else {
                delete state.cache[id];
            }
        }),
    );
    state.listeners.forEach(fn =>
        fn(nodes.map(id => ({ id, value: values[id] }))),
    );
    nodes.forEach(id => {
        if (state.itemListeners[id]) {
            state.itemListeners[id].forEach(fn => fn(values[id]));
        }
    });
};

type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

const createPollingNetwork = <Delta, Data>(
    url: string,
): NetworkCreator<Delta, Data, SyncStatus> => (
    sessionId,
    getMessages,
    handleMessages,
    handleCrossTabChanges,
): Network<SyncStatus> => {
    const connectionListeners = [];
    let currentSyncStatus = { status: 'disconnected' };

    const {
        BroadcastChannel,
        createLeaderElection,
    } = require('broadcast-channel');
    const channel = new BroadcastChannel('local-first', {
        webWorkerSupport: false,
    });

    channel.onmessage = (msg: PeerChange) => {
        console.log('got a message');
        handleCrossTabChanges(msg).catch(err =>
            console.log('failed', err.message, err.stack),
        );
        console.log('Processed message', msg);
    };

    const elector = createLeaderElection(channel);
    let sync = () => {};
    elector.awaitLeadership().then(() => {
        console.log('Im the leader');
        const poll = poller(
            3 * 1000,
            () =>
                new Promise(res => {
                    backOff(() =>
                        syncFetch(url, sessionId, getMessages, messages =>
                            handleMessages(messages, peerChange =>
                                channel.postMessage(peerChange),
                            ),
                        ).then(
                            () => {
                                currentSyncStatus = { status: 'connected' };
                                connectionListeners.forEach(f =>
                                    f(currentSyncStatus),
                                );
                                res();
                                return true;
                            },
                            err => {
                                console.error('Failed to sync');
                                console.error(err);
                                currentSyncStatus = { status: 'disconnected' };
                                connectionListeners.forEach(f =>
                                    f(currentSyncStatus),
                                );
                                return false;
                            },
                        ),
                    );
                }),
        );
        poll();
        sync = debounce(poll);
    });

    return {
        setDirty: () => sync(),
        onSyncStatus: fn => {
            connectionListeners.push(fn);
        },
        getSyncStatus() {
            return currentSyncStatus;
        },
        sendCrossTabChanges(peerChange) {
            channel.postMessage(peerChange);
        },
    };
};

const getMessages = function<Delta, Data>(
    persistence: DeltaPersistence,
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    return Promise.all(
        persistence.collections.map(async (id: string): Promise<?ClientMessage<
            Delta,
            Data,
        >> => {
            const deltas = await persistence.deltas(id);
            const serverCursor = await persistence.getServerCursor(id);
            if (deltas.length || !serverCursor || reconnected) {
                return {
                    type: 'sync',
                    collection: id,
                    serverCursor,
                    deltas: deltas.map(({ node, delta }) => ({
                        node,
                        delta,
                    })),
                };
            }
        }),
    ).then(a => a.filter(Boolean));
};

export const handleMessages = async function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: DeltaPersistence,
    messages: Array<ServerMessage<Delta, Data>>,
    state: { [colid: string]: CollectionState<Data, any> },
    recvClock: HLC => void,
    sendCrossTabChanges: PeerChange => mixed,
) {
    await Promise.all(
        messages.map(async msg => {
            if (msg.type === 'sync') {
                const col = state[msg.collection];
                // await applyDeltas(state, msg.collection, col, msg.deltas, {
                //     type: 'server',
                //     cursor: msg.serverCursor,
                // });

                const changed = {};
                msg.deltas.forEach(delta => {
                    changed[delta.node] = true;
                });

                const deltasWithStamps = msg.deltas.map(delta => ({
                    ...delta,
                    stamp: crdt.delta.stamp(delta.delta),
                }));

                const changedIds = Object.keys(changed);
                const data = await persistence.applyDeltas(
                    msg.collection,
                    deltasWithStamps,
                    msg.serverCursor,
                    (data, delta) => crdt.delta.apply(data, delta),
                );

                if (col.listeners.length) {
                    const changes = changedIds.map(id => ({
                        id,
                        value: crdt.value(data[id]),
                    }));
                    col.listeners.forEach(listener => {
                        listener(changes);
                    });
                }
                changedIds.forEach(id => {
                    // Only update the cache if the node has already been cached
                    if (state[msg.collection].cache[id]) {
                        state[msg.collection].cache[id] = data[id];
                    }
                    if (col.itemListeners[id]) {
                        col.itemListeners[id].forEach(fn =>
                            fn(crdt.value(data[id])),
                        );
                    }
                });

                if (changedIds.length) {
                    console.log(
                        'Broadcasting to client-level listeners',
                        changedIds,
                    );
                    sendCrossTabChanges({
                        col: msg.collection,
                        nodes: changedIds,
                    });
                }

                let maxStamp = null;
                msg.deltas.forEach(delta => {
                    const stamp = crdt.delta.stamp(delta.delta);
                    if (!maxStamp || stamp > maxStamp) {
                        maxStamp = stamp;
                    }
                });
                if (maxStamp) {
                    recvClock(hlc.unpack(maxStamp));
                }
            } else if (msg.type === 'ack') {
                return persistence.deleteDeltas(msg.collection, msg.deltaStamp);
            }
        }),
    );
};

type NetworkCreator<Delta, Data, SyncStatus> = (
    sessionId: string,
    getMessages: (fresh: boolean) => Promise<Array<ClientMessage<Delta, Data>>>,
    handleMessages: (
        Array<ServerMessage<Delta, Data>>,
        (PeerChange) => mixed,
    ) => Promise<void>,
    handleCrossTabChanges: (PeerChange) => Promise<void>,
) => Network<SyncStatus>;

function createClient<Delta, Data, SyncStatus>(
    // Yeah persistence contains the crdt I think...
    crdt: CRDTImpl<Delta, Data>,
    clockPersist: ClockPersist,
    persistence: DeltaPersistence,
    createNetwork: NetworkCreator<Delta, Data, SyncStatus>,
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

    const recvClock = (newClock: HLC) => {
        clock = hlc.recv(clock, newClock, Date.now());
        clockPersist.set(clock);
    };

    const network = createNetwork(
        clock.node,
        fresh => getMessages(persistence, fresh),
        (messages, sendCrossTabChanges) =>
            handleMessages(
                crdt,
                persistence,
                messages,
                state,
                recvClock,
                sendCrossTabChanges,
            ),
        (msg: PeerChange) => {
            return onCrossTabChanges(
                crdt,
                persistence,
                state[msg.colid],
                msg.colid,
                msg.nodes,
            );
        },
    );

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
                network.setDirty,
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
