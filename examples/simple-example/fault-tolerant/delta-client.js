// @flow
import type { ClientMessage, ServerMessage, CursorType } from './server.js';
import {
    type Schema,
    validate,
    validateSet,
} from '@local-first/nested-object-crdt/schema.js';
import type {
    Persistence,
    Collections,
    ClientState,
    CollectionState,
    Collection,
} from './client';
import * as hlc from '@local-first/hybrid-logical-clock';
import {
    optimisticUpdates,
    newCollection,
    getStamp,
    applyDeltas,
} from './client';

export const syncMessages = function<Delta, Data>(
    client: ClientState<Delta, Data>,
    reconnected: boolean,
): Promise<Array<ClientMessage<Delta, Data>>> {
    return Promise.all(
        Object.keys(client.collections).map(
            async (id: string): Promise<?ClientMessage<Delta, Data>> => {
                const col = client.collections[id];
                const deltas = await client.persistence.deltas(id);
                const serverCursor = await client.persistence.getServerCursor(
                    id,
                );
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
            },
        ),
    ).then(a => a.filter(Boolean));
};

export const onMessage = async function<Delta, Data>(
    state: ClientState<Delta, Data>,
    msg: ServerMessage<Delta, Data>,
) {
    if (msg.type === 'sync') {
        if (!state.collections[msg.collection]) {
            state.collections[msg.collection] = newCollection();
        }
        const col = state.collections[msg.collection];
        await applyDeltas(state, msg.collection, col, msg.deltas, {
            type: 'server',
            cursor: msg.serverCursor,
        });
        let maxStamp = null;
        msg.deltas.forEach(delta => {
            const stamp = state.crdt.deltas.stamp(delta.delta);
            if (!maxStamp || stamp > maxStamp) {
                maxStamp = stamp;
            }
        });
        if (maxStamp) {
            state.hlc = hlc.recv(state.hlc, hlc.unpack(maxStamp), Date.now());
            state.persistence.saveHLC(state.hlc);
        }
    } else if (msg.type === 'ack') {
        return state.persistence.deleteDeltas(msg.collection, msg.deltaStamp);
    }
};
