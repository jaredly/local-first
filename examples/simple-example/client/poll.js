// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    debounce,
    type ClientState,
    type CRDTImpl,
} from '../fault-tolerant/client';
import type { Persistence } from '../fault-tolerant/clientTypes.js';
import backOff from '../shared/back-off';

const sync = async function<Delta, Data>(
    url: string,
    client: ClientState<Delta, Data>,
) {
    const messages = await syncMessages(client.persistence, client.collections);
    console.log('sync:messages', messages);
    // console.log('messages', messages);
    const res = await fetch(`${url}?sessionId=${client.hlc.node}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
    if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
    }
    const data = await res.json();
    console.log('sync:data', data);
    await Promise.all(data.map(message => onMessage(client, message)));
};

const poller = (time, fn) => {
    let tid = null;
    const poll = () => {
        clearTimeout(tid);
        fn()
            .catch(() => {})
            .then(() => {
                // tid = setTimeout(poll, time);
            });
    };
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.hidden) {
                clearTimeout(tid);
            } else {
                poll();
            }
        },
        false,
    );
    window.addEventListener(
        'focus',
        () => {
            poll();
        },
        false,
    );
    return poll;
};

export default function<Delta, Data>(
    persistence: Persistence<Delta, Data>,
    url: string,
    crdt: CRDTImpl<Delta, Data>,
): {
    client: ClientState<Delta, Data>,
    onConnection: ((boolean) => void) => void,
} {
    const listeners = [];
    const poll = poller(
        3 * 1000,
        () =>
            new Promise(res => {
                backOff(() =>
                    sync(url, client).then(
                        () => {
                            listeners.forEach(f => f(true));
                            res();
                            return true;
                        },
                        err => {
                            console.error('Failed to sync');
                            console.error(err);
                            listeners.forEach(f => f(false));
                            return false;
                        },
                    ),
                );
            }),
    );
    const client = makeClient<Delta, Data>(persistence, crdt, debounce(poll), [
        'tasks',
    ]);

    poll();
    return {
        onConnection: fn => {
            listeners.push(fn);
        },
        client,
    };
}
