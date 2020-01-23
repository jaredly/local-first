// @flow
import * as hlc from '@local-first/hybrid-logical-clock';

export type ClientMessage<Delta, Data> = {
    type: 'sync',
    collection: string,
    lastSeenDelta: number,
    deltas: Array<{ node: string, delta: Delta }>,
};

export type ServerMessage<Delta, Data> =
    | {
          type: 'sync',
          collection: string,
          lastSeenDelta: number,
          deltas: Array<{ node: string, delta: Delta }>,
      }
    | {
          type: 'full',
          collection: string,
          data: { [key: string]: Data },
          lastSeenDelta: number,
      };

// This doesn't have any special permissions things
// We'll do collection-level permissions.

type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
};

type Collection<Delta, Data> = {
    data: { [key: string]: Data },
    deltas: Array<{ node: string, delta: Delta, sessionId: string }>,
};

type Connection<Delta, Data> = {
    sessionId: string,
    send: (msg: ServerMessage<Delta, Data>) => void,
    on: (listener: (msg: ClientMessage<Delta, Data>) => void) => void,
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
): ({
    collections: { [key: string]: Collection<Delta, Data> },
    onConnect: (connection: Connection<Delta, Data>) => void,
}) => {
    const collections: {
        [collectionId: string]: Collection<Delta, Data>,
    } = {};

    const applyDeltas = (nodes, deltas) => {
        deltas.forEach(delta => {
            if (!nodes[delta.node]) {
                nodes[delta.node] = crdt.createEmpty();
            }
            nodes[delta.node] = crdt.applyDelta(nodes[delta.node], delta.delta);
        });
    };

    const onConnect = (connection: Connection<Delta, Data>) => {
        connection.on(message => {
            console.log('got message', message);
            if (message.type === 'sync') {
                // collection: user/{id}/priv/colname
                // collection: user/{id}/pub/colname
                // TODO validate access to message.collection
                if (!collections[message.collection]) {
                    collections[message.collection] = { data: {}, deltas: [] };
                }
                message.deltas.forEach(item => {
                    collections[message.collection].deltas.push({
                        ...item,
                        sessionId: connection.sessionId,
                    });
                });
                applyDeltas(
                    collections[message.collection].data,
                    message.deltas,
                );
                if (message.lastSeenDelta === 0) {
                    connection.send({
                        type: 'full',
                        collection: message.collection,
                        data: collections[message.collection].data,
                        lastSeenDelta:
                            collections[message.collection].deltas.length,
                    });
                } else {
                    connection.send({
                        type: 'sync',
                        collection: message.collection,
                        deltas: collections[message.collection].deltas
                            .slice(message.lastSeenDelta)
                            .filter(
                                delta =>
                                    delta.sessionId !== connection.sessionId,
                            )
                            .map(({ node, delta }) => ({ node, delta })),
                        lastSeenDelta:
                            collections[message.collection].deltas.length,
                    });
                }
            }
        });
    };
    return { collections, onConnect };
};

export default make;
