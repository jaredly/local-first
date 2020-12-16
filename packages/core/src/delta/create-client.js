// @flow

import type { Client } from '../types';
import type {
    Persistence,
    OldNetwork,
    Network,
    PersistentClock,
    DeltaPersistence,
    FullPersistence,
    NetworkCreator,
    Export,
} from '../types';
import { peerTabAwareNetwork } from '../peer-tabs';
import type { HLC } from '../../../hybrid-logical-clock';
import * as hlc from '../../../hybrid-logical-clock';
import { type Schema } from '../../../nested-object-crdt/src/schema.js';
import { MissingNodeError } from '../../../nested-object-crdt/src/apply.js';
import deepEqual from 'fast-deep-equal';
import { type PeerChange } from '../types';

import { create as createUndoManager } from '../undo-manager';

import {
    newCollection,
    getCollection,
    onCrossTabChanges,
    type CRDTImpl,
    type CollectionState,
} from '../shared';

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

import { type ClientMessage, type ServerMessage } from '../server';
export const getMessages = async function<Delta, Data>(
    persistence: DeltaPersistence,
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    const items: Array<?ClientMessage<Delta, Data>> = await Promise.all(
        persistence.collections.map(async (collection: string): Promise<?ClientMessage<
            Delta,
            Data,
        >> => {
            const deltas = await persistence.deltas(collection);
            const serverCursor = await persistence.getServerCursor(collection);
            if (deltas.length || serverCursor == null || reconnected) {
                // console.log('messages yeah', serverCursor);
                return {
                    type: 'sync',
                    collection,
                    serverCursor,
                    deltas: deltas.map(({ node, delta }) => ({
                        node,
                        delta,
                    })),
                };
            }
        }),
    );
    return items.filter(Boolean);
};

const handleMessage = async function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: DeltaPersistence,
    state: { [colid: string]: CollectionState<Data, any> },
    recvClock: HLC => void,
    sendCrossTabChanges: PeerChange => mixed,
    msg: ServerMessage<Delta, Data>,
): Promise<?ClientMessage<Delta, Data>> {
    if (msg.type === 'sync') {
        const col = state[msg.collection];

        const changed = {};
        msg.deltas.forEach(delta => {
            changed[delta.node] = true;
        });

        const deltasWithStamps = msg.deltas.map(delta => ({
            ...delta,
            stamp: crdt.deltas.stamp(delta.delta),
        }));

        const changedIds = Object.keys(changed);
        // console.log('applying deltas', msg.serverCursor);
        let data;
        try {
            data = await persistence.applyDeltas(
                msg.collection,
                deltasWithStamps,
                msg.serverCursor,
                (data, delta) => crdt.deltas.apply(data, delta),
            );
        } catch (err) {
            // assume that the problem is that we don't have some infos.
            // It'll be a little annoying to plumb the node's ID around, so
            // here we are.

            // So, for the moment, we just go ahead and require all changes since the dawn
            // of time.
            // This is rather inefficient, and once our server keeps a realized
            // cache of all nodes, it can just send a dump.
            // That will also allow us to do nice thing like "hash the db state & compare"
            if (err instanceof MissingNodeError) {
                return {
                    type: 'sync',
                    collection: msg.collection,
                    // since the dawn of time, thanks
                    serverCursor: -1,
                    deltas: [],
                };
            } else {
                // dunno
                throw err;
            }
        }

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
            if (state[msg.collection].cache[id] != null) {
                state[msg.collection].cache[id] = data[id];
            }
            if (col.itemListeners[id]) {
                col.itemListeners[id].forEach(fn => fn(crdt.value(data[id])));
            }
        });

        if (changedIds.length) {
            // console.log(
            //     'Broadcasting to client-level listeners',
            //     changedIds,
            // );
            sendCrossTabChanges({
                col: msg.collection,
                nodes: changedIds,
            });
        }

        let maxStamp = null;
        msg.deltas.forEach(delta => {
            const stamp = crdt.deltas.stamp(delta.delta);
            if (maxStamp == null || stamp > maxStamp) {
                maxStamp = stamp;
            }
        });
        if (maxStamp) {
            recvClock(hlc.unpack(maxStamp));
        }
        return {
            type: 'ack',
            collection: msg.collection,
            serverCursor: msg.serverCursor,
        };
    } else if (msg.type === 'ack') {
        await persistence.deleteDeltas(msg.collection, msg.deltaStamp);
    }
};

export const handleMessages = async function<Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    persistence: DeltaPersistence,
    messages: Array<ServerMessage<Delta, Data>>,
    state: { [colid: string]: CollectionState<Data, any> },
    recvClock: HLC => void,
    sendCrossTabChanges: PeerChange => mixed,
): Promise<Array<ClientMessage<Delta, Data>>> {
    // console.log('RECV', messages);
    const res = [];
    for (let msg of messages) {
        const clientMessage = await handleMessage(
            crdt,
            persistence,
            state,
            recvClock,
            sendCrossTabChanges,
            msg,
        );
        if (clientMessage) {
            res.push(clientMessage);
        }
    }
    // const res: Array<?ClientMessage<Delta, Data>> = await Promise.all(
    //     messages.map(async (msg): Promise<?ClientMessage<Delta, Data>> => {
    //         return
    //     }),
    // );
    // return res.filter(Boolean);
    return res;
};

export const initialState = function<Data>(
    collections: Array<string>,
): { [key: string]: CollectionState<Data, any> } {
    const state = {};
    collections.forEach(id => (state[id] = newCollection()));
    return state;
};

const tabIsolatedNetwork = function<SyncStatus>(
    network: Network<SyncStatus>,
): OldNetwork<SyncStatus> {
    const connectionListeners = [];
    let currentSyncStatus = network.initial;
    const sync = network.createSync(
        () => {},
        (status: SyncStatus) => {
            currentSyncStatus = status;
            connectionListeners.forEach(f => f(currentSyncStatus));
        },
        () => {
            // do nothing
        },
    );
    let syncTimer = null;
    return {
        setDirty: () => {
            if (syncTimer) return;
            syncTimer = setTimeout(() => {
                syncTimer = null;
                sync(false);
            }, 0);
        },
        onSyncStatus: fn => {
            connectionListeners.push(fn);
        },
        getSyncStatus() {
            return currentSyncStatus;
        },
        sendCrossTabChanges(peerChange) {},
    };
};

function createClient<Delta, Data, SyncStatus>(
    name: string,
    crdt: CRDTImpl<Delta, Data>,
    schemas: { [colid: string]: Schema },
    clock: PersistentClock,
    persistence: DeltaPersistence,
    createNetwork: NetworkCreator<Delta, Data, SyncStatus>,
): Client<SyncStatus> {
    const state = initialState(persistence.collections);
    const undoManager = createUndoManager();

    // console.log();

    const innerNetwork = createNetwork(
        clock.now.node,
        fresh => getMessages(persistence, fresh),
        (messages, sendCrossTabChanges) =>
            // TRAIL - I think this is where things break?
            handleMessages(crdt, persistence, messages, state, clock.recv, sendCrossTabChanges),
    );

    const network = persistence.tabIsolated
        ? tabIsolatedNetwork(innerNetwork)
        : peerTabAwareNetwork(
              name,
              (msg: PeerChange) => {
                  return onCrossTabChanges(crdt, persistence, state[msg.col], msg.col, msg.nodes);
              },
              innerNetwork,
          );

    const collections = {};

    return {
        sessionId: clock.now.node,
        getStamp: clock.get,
        setDirty: network.setDirty,
        undo: undoManager.undo,
        // TODO export should include a stamp
        fullExport<Data>(): Promise<Export<Data>> {
            console.log('full export');
            return persistence.fullExport();
        },
        teardown: async () => {
            console.log('tearing down folks');
            clock.teardown();
            await persistence.teardown();
        },
        async importDump<Data>(dump) {
            await Promise.all(
                Object.keys(dump).map(async key => {
                    const deltas = Object.keys(dump[key]).map(id => {
                        const node = dump[key][id];
                        // $FlowFixMe datas arguing
                        const inner = crdt.deltas.replace(node);
                        const delta = {
                            node: id,
                            delta: inner,
                            stamp: crdt.deltas.stamp(inner),
                        };
                        return delta;
                    });
                    await persistence.applyDeltas(key, deltas, null, (data, delta) =>
                        crdt.deltas.apply(data, delta),
                    );
                }),
            );
            //
        },
        getCollection<T>(colid: string) {
            if (state[colid] == null) {
                throw new Error(
                    `Trying to get a collection ${colid} that wasn't set up for this client.`,
                );
            }
            if (!collections[colid]) {
                collections[colid] = getCollection(
                    colid,
                    crdt,
                    persistence,
                    state[colid],
                    clock.get,
                    network.setDirty,
                    network.sendCrossTabChanges,
                    schemas[colid],
                    undoManager,
                );
            }
            return collections[colid];
        },
        onSyncStatus(fn) {
            network.onSyncStatus(fn);
        },
        getSyncStatus() {
            return network.getSyncStatus();
        },
    };
}

export default createClient;
